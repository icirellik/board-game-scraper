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

const gameBrowseRoot = 'https://boardgamegeek.com/browse/boardgame';
const output = '/tmp/games.txt';
const complete = '/tmp/game-loaded.json';

const singleGame = 'https://boardgamegeek.com/boardgame/44338/ninja-burger-secret-ninja-death-touch-edition';

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
  if (fs.existsSync(complete)) {
    loadedGames = JSON.parse(fs.readFileSync(complete));
  }

  // Open the output data file.
  const fd = fs.openSync(output, 'a');

  // Create a browser.
  const browser = await scraper.createBrowser();

  // Attach SIGINT handler with browser cleanup.
  process.on('SIGINT', async () => {
    console.log("Interrupted exiting.");
    await scraper.closeBrowser(browser);
    process.exit();
  });

  const page = await scraper.createPage(browser);

  let bookmark = gameBrowseRoot;
  let fullGames = 1;
  while (!!bookmark) {
    const { games, nextUrl, success } = await scraper.gameList(page, bookmark);
    if (!success) {
      continue;
    }
    bookmark = nextUrl;

    // Get all game details
    let count = 1;
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
          fs.writeSync(fd, JSON.stringify(gameDetails) + '\n');
          fullGames++;
        }
      }
      count++;

      loadedGames.push(game.id);

      performance.mark('gameEnd');
      performance.measure('game', 'gameStart', 'gameEnd');
      const measure = performance.getEntriesByName('game')[0];
      console.log(`game - ${measure.duration}`);
      performance.clearMarks();
      performance.clearMeasures();
    }
    saveLoaded(loadedGames);
    fs.fsyncSync(fd);
    console.log(`games loaded ${fullGames.length} - ${bookmark}`)
  }

  await scraper.closeBrowser(browser);
  fs.closeSync(fd);
})()
.catch(err => {
  console.log(err);
  process.exit(1);
});

function saveLoaded(loadedGames) {
  if (fs.existsSync(complete)) {
    fs.truncateSync(complete);
  }
  fs.writeFileSync(complete, JSON.stringify(loadedGames));
}
