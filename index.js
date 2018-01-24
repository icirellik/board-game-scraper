import cluster from 'cluster';
import fs from 'fs';
import http from 'http';
import program from 'commander';
import puppeteer from 'puppeteer';
import readline from 'readline';
import url from 'url';
import {
  performance,
} from 'perf_hooks';

import {
  appendDetails,
  appendLoaded,
  appendLoadedRating,
  appendLoadedRatings,
  appendRatings,
  readLoaded,
  readLoadedRatings,
  setResume,
} from './src/storage';
import {
  closeBrowser,
  createBrowser,
  createPage,
  gameList,
  gameDetails,
  gameRatings,
} from './src/scraper';
import {
  markStart,
  markEnd,
} from './src/profiling';

const numCPUs = 4;

const BGG_GAME_BROWSE_ROOT_URL = 'https://boardgamegeek.com/browse/boardgame';

const GAME_DETAILS_FILE = '/tmp/games.txt';
const GAMES_LOADED_FILE = '/tmp/game-loaded.json';

async function singleGameRatings(gameId) {
  let allRatings = [];
  let ratings;
  let pageId = 1;
  while (!ratings || ratings.length > 0) {
    ratings = await gameRatings(gameId, pageId);
    allRatings = allRatings.concat(ratings);
    pageId++;
  }
  return allRatings;
}

/**
 * Downloads all of the board game ratings.
 */
async function allGameRatings() {
  // Download ratings.
  const gameIds = readLoaded();
  let loadedRatings = readLoadedRatings();
  for (const gameId of gameIds) {
    if (gameId in loadedRatings) {
      console.log(`skipping ratings ${gameId}`);
      continue;
    }
    const ratings = await singleGameRatings(gameId);
    appendRatings({
      gameId,
      ratings,
    });
    loadedRatings = appendLoadedRating(gameId);
  }
}

async function allGameDetails({ browser, startPage, limit }) {
  // Check for previously loaded games.
  const loadedGameCache = readLoaded();

  // Create the page.
  const page = await createPage(browser);

  let bookmark = (startPage > 0) ? `${BGG_GAME_BROWSE_ROOT_URL}/page/${startPage}` : BGG_GAME_BROWSE_ROOT_URL;
  let totalNewGames = 0;
  let totalFailedGames = 0;
  let totalSkippedGames = 0;
  while (!!bookmark && (totalNewGames + totalSkippedGames + totalFailedGames) < limit) {
    markStart('gamePage');
    const { games, nextUrl, success } = await gameList(page, bookmark);
    if (!success) {
      continue;
    }
    bookmark = nextUrl;

    // Get all game details
    let batchIndex = 0;
    const gameBatch = [];
    const gameIdBatch = [];
    for (const game of games) {
      markStart('game');
      console.log(`progress - ${totalNewGames + totalSkippedGames + totalFailedGames + 1} - ${batchIndex + 1} / ${games.length}`);
      batchIndex++;

      console.log(game.href);
      // Pull the game id out of the url.
      game.id = url.parse(game.href).pathname.split('/')[2];

      if (loadedGameCache.includes(game.id)) {
        console.log(`skipping ${game.id}`);
        totalSkippedGames++;
        continue;
      }

      let loading = true;
      let retryCount = 0;
      while (loading) {
        const { details, success, href } = await gameDetails(page, game);
        if (success) {
          loadedGameCache.push(game.id);
          gameIdBatch.push(game.id);
          gameBatch.push(details);
          totalNewGames++;
          loading = false;
        } else {
          retryCount++;
        }
        if (retryCount === 10) {
          totalFailedGames++;
          loading = false;
        }
      }

      markEnd('game');
      if ((totalNewGames + totalSkippedGames + totalFailedGames) >= limit) {
        break;
      }
    }

    appendDetails(gameBatch);
    appendLoaded(gameIdBatch);

    console.log(`new games loaded ${totalNewGames} - ${bookmark}`);
    markStart('gamePage');
  }
}

/**
 * Make sure that we see uncaught errors.
 */
process.on('uncaughtException', (err) => {
  console.log(err);
  process.exit(1);
});

async function allGames({ startPage, resume, limit }) {
  // Quick hack to for the base path to a resume.
  if (resume) {
    setResume(true);
  }

  // Create a browser.
  const browser = await createBrowser();

  // Attach SIGINT handler with browser cleanup.
  process.on('SIGINT', async () => {
    console.log('Interrupted exiting.');
    await closeBrowser(browser);
    process.exit();
  });

  // Get all game deetails.
  await allGameDetails({
    browser,
    limit,
    startPage,
  });

  // Get the game ratings.
  await allGameRatings();

  // Close the browser and exit.
  await closeBrowser(browser);
}

/**
 * Rune a single game.
 *
 * @param {*} gameId
 */
async function singleGame(gameId) {
  const ratings = await singleGameRatings(gameId);
  console.log(ratings);
}

/**
 * Application start.
 */
program
  .version('1.0.0')
  .option('-D, --only-game-details', 'Only gather the game details.', false)
  .option('-g, --game-id <n>', 'A single game id to load.', parseInt)
  .option('-l, --limit <n>', 'The maximun games to load.', parseInt)
  .option('-p, --start-page <n>', 'The start page to begin browsing from.', parseInt)
  .option('-R, --only-game-ratings', 'Only gather the game ratings.', false)
  .option('-r, --resume', 'Resumes the previous run.', false)
  .option('-y, --yes', 'Answer yes to all prompts.', false)
  .parse(process.argv);

// Set defaults
program.gameId = (program.gameId === undefined) ? 0 : program.gameId;
program.limit = (program.limit === undefined) ? 0 : program.limit;
program.onlyGameDetails = (program.onlyGameDetails === undefined) ? false : program.onlyGameDetails;
program.onlyGameRatings = (program.onlyGameRatings === undefined) ? false : program.onlyGameRatings;
program.resume = (program.resume === undefined) ? false : program.resume;
program.startPage = (program.startPage === undefined) ? 0 : program.startPage;
program.yes = (program.yes === undefined) ? false : program.yes;

/**
 * Lists the current configuration files.
 */
function displayConfiguration() {
  console.log('Board Game Scraper');
  console.log('------------------');
  console.log(`Resuming previous run: ${program.resume}`);
  console.log(`Start Page: ${program.startPage}`);
  console.log(`Game Limit: ${program.limit}`);
  console.log(`Game Id: ${program.gameId}`);
  console.log(`Only Game Details: ${program.onlyGameDetails}`);
  console.log(`Only Game Ratings: ${program.onlyGameRatings}`);
  console.log(`Yes to all prompts: ${program.yes}`);
  console.log('\n');
}
displayConfiguration();

/**
 * The main function.
 */
async function main(config) {
  if (config.gameId > 0) {
    await singleGame(config.gameId);
  } else {
    await allGames({
      startPage: config.startPage,
      resume: config.resume,
      limit: config.limit,
    });
  }
}

if (program.yes) {
  main(program);
} else {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question('Are these settings correct? ', async (answer) => {
    if (answer === 'y' || answer === 'Y' || answer === 'yes') {
      await main(program);
    }
    process.exit();
    rl.close();
  });
}
