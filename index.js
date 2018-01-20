import fs from 'fs';
import puppeteer from 'puppeteer';
import cluster from 'cluster';
import http from 'http';
import url from 'url';
import {
  performance
} from 'perf_hooks';

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

(async () => {

  // Check for previously loaded games.
  let loadedGames = [];
  if (fs.existsSync(GAMES_LOADED_FILE)) {
    loadedGames = JSON.parse(fs.readFileSync(GAMES_LOADED_FILE));
  } else {
    if (fs.existsSync(GAME_DETAILS_FILE)) {
      fs.unlinkSync(GAME_DETAILS_FILE);
    }
  }

  // Open the output data file.
  const fd = fs.openSync(GAME_DETAILS_FILE, 'a');

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
  let fullGames = 1;
  while (!!bookmark) {
    const { games, nextUrl, success } = await scraper.gameList(page, bookmark);
    if (!success) {
      continue;
    }
    bookmark = nextUrl;

    // Get all game details
    let count = 1;
    let fileBuffer = '';
    for (let game of games) {

      // Pull the game id out of the url.
      game.id = url.parse(game.href).pathname.split('/')[2];

      if (loadedGames.includes(game.id)) {
        console.log(`skipping ${game.id}`);
        fullGames++;
        continue;
      }

      performance.mark('gameStart');
      console.log(`games loaded - ${fullGames} - ${count} / ${games.length}`);
      let fetchDetails = true;
      while (fetchDetails) {
        const { gameDetails, success, href } = await scraper.gameDetails(page, game);
        if (success) {
          fetchDetails = false;
          loadedGames.push(game.id);
          fileBuffer += JSON.stringify(gameDetails) + '\n';
          fullGames++;
        }
      }
      count++;

      performance.mark('gameEnd');
      performance.measure('game', 'gameStart', 'gameEnd');
      const measure = performance.getEntriesByName('game')[0];
      console.log(`game - ${measure.duration}`);
      performance.clearMarks();
      performance.clearMeasures();
    }
    fs.appendFileSync(fd, fileBuffer);
    saveLoaded(loadedGames);
    console.log(`games loaded ${fullGames.length} - ${bookmark}`)
  }

  await scraper.closeBrowser(browser);
  fs.closeSync(fd);
})()
.catch(err => {
  console.log(err);
  process.exit(1);
});

/**
 * Stores the games that have successfully loaded to a lookup file.
 */
function saveLoaded(loadedGames) {
  if (fs.existsSync(GAMES_LOADED_FILE)) {
    fs.truncateSync(GAMES_LOADED_FILE);
  }
  fs.writeFileSync(GAMES_LOADED_FILE, JSON.stringify(loadedGames));
}

/**
 * Make sure that we see uncaught errors.
 */
process.on('uncaughtException', err => {
  console.log(err);
  process.exit(1);
})
