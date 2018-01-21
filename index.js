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
import scraper from './src/scraper';

const numCPUs = 4;

const BGG_GAME_BROWSE_ROOT_URL = 'https://boardgamegeek.com/browse/boardgame';

const GAME_DETAILS_FILE = '/tmp/games.txt';
const GAMES_LOADED_FILE = '/tmp/game-loaded.json';

// const singleGame = 'https://boardgamegeek.com/boardgame/29649/barney-google-and-spark-plug-game';

// (async () => {
//   const browser = await scraper.createBrowser();
//   const page = await scraper.createPage(browser);
//   const { gameDetails, success, href } = await scraper.gameDetails(page, {
//     href: singleGame
//   });
//   await scraper.closeBrowser(browser);
// })()

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
  const browser = await scraper.createBrowser();

  // Attach SIGINT handler with browser cleanup.
  process.on('SIGINT', async () => {
    console.log("Interrupted exiting.");
    await scraper.closeBrowser(browser);
    process.exit();
  });

  // Create the page.
  const page = await scraper.createPage(browser);

  let bookmark = BGG_GAME_BROWSE_ROOT_URL;
  let totalNewGames = 1;
  let totalFailedGames = 0;
  let totalSkippedGames = 0;
  while (!!bookmark) {
    const { games, nextUrl, success } = await scraper.gameList(page, bookmark);
    if (!success) {
      continue;
    }
    bookmark = nextUrl;

    // Get all game details
    let batchIndex = 1;
    let gameBatch = [];
    let gameIdBatch = [];
    for (let game of games) {
      // Pull the game id out of the url.
      game.id = url.parse(game.href).pathname.split('/')[2];

      if (loadedGameCache.includes(game.id)) {
        console.log(`skipping ${game.id}`);
        totalSkippedGames++;
        continue;
      }

      performance.mark('gameStart');
      console.log(`games loaded - ${totalNewGames + totalSkippedGames + totalFailedGames} - ${batchIndex} / ${games.length}`);
      let loading = true;
      let retryCount = 0;
      while (loading) {
        const { gameDetails, success, href } = await scraper.gameDetails(page, game);
        if (success) {
          loadedGameCache.push(game.id);
          gameIdBatch.push(game.id);
          gameBatch.push(gameDetails);
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
      batchIndex++;

      performance.mark('gameEnd');
      performance.measure('game', 'gameStart', 'gameEnd');
      const measure = performance.getEntriesByName('game')[0];
      console.log(`game - ${measure.duration}`);
      performance.clearMarks();
      performance.clearMeasures();

    }

    appendDetails(gameBatch);
    appendLoaded(gameIdBatch);

    console.log(`games loaded ${totalNewGames.length} - ${bookmark}`)
  }
  await scraper.closeBrowser(browser);
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
})
