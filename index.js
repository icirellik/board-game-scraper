import fs from 'fs';
import puppeteer from 'puppeteer';
import cluster from 'cluster';
import http from 'http';
import url from 'url';
import program from 'commander';
import {
  performance
} from 'perf_hooks';

import {
  appendDetails,
  appendLoaded,
  readLoaded,
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

// (async () => {
//   const browser = await createBrowser();
//   const page = await createPage(browser);
//   const ratings = await gameRatings(page, 221194, 1);
//   await closeBrowser(browser);
// })()

// const singleGame = 'https://boardgamegeek.com/boardgame/231939/oregon-trail-hunt-food-card-game';

// (async () => {
//   const browser = await createBrowser();
//   const page = await createPage(browser);
//   const rawData = await gameDetails(page, {
//     href: singleGame
//   });
//   console.log(raw)
//   await closeBrowser(browser);
// })();

program
  .version('1.0.0')
  .option('-r, --resume', 'Resumes the previous run.')
  .parse(process.argv);

function shouldResume(program) {
  if (program.resume) {
    return true;
  }
  return false;
}

const RESUMING = shouldResume(program);

(async () => {
  // Quick hack to for the base path to a resume.
  if (RESUMING) {
    setResume(true);
  }

  // Check for previously loaded games.
  let loadedGameCache = readLoaded();

  // Create a browser.
  const browser = await createBrowser();

  // Attach SIGINT handler with browser cleanup.
  process.on('SIGINT', async () => {
    console.log("Interrupted exiting.");
    await scraper.closeBrowser(browser);
    process.exit();
  });

  // Create the page.
  const page = await createPage(browser);

  let bookmark = BGG_GAME_BROWSE_ROOT_URL;
  let totalNewGames = 0;
  let totalFailedGames = 0;
  let totalSkippedGames = 0;
  while (!!bookmark) {
    const { games, nextUrl, success } = await gameList(page, bookmark);
    if (!success) {
      continue;
    }
    bookmark = nextUrl;

    // Get all game details
    let batchIndex = 0;
    let gameBatch = [];
    let gameIdBatch = [];
    for (let game of games) {
      markStart('game');
      console.log(`progress - ${totalNewGames + totalSkippedGames + totalFailedGames + 1} - ${batchIndex + 1} / ${games.length}`);
      batchIndex++;

      console.log(game.href)
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
    }

    appendDetails(gameBatch);
    appendLoaded(gameIdBatch);

    console.log(`new games loaded ${totalNewGames} - ${bookmark}`)
  }

  // Download ratings.
  let gameIds = readLoaded();
  for (const gameId of gameIds) {
    let ratings;
    let page = 1;
    while (!!ratings || ratings.length > 0) {
      ratings = gameRatings(page, gameId, )
    }
  }

  await closeBrowser(browser);
})()
.catch(err => {
  console.log(err);
  process.exit(1);
});

/**
 * Make sure that we see uncaught errors.
 */
process.on('uncaughtException', err => {
  console.log(err);
  process.exit(1);
});
