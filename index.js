import fs from 'fs';
import puppeteer from 'puppeteer';
import scraper from './src/scraper';

const gameBrowseRoot = 'https://boardgamegeek.com/browse/boardgame';
const output = '/tmp/games.txt';

const singleGame = 'https://boardgamegeek.com/boardgame/102794/caverna-cave-farmers';

// (async () => {
//   const browser = await scraper.createBrowser();
//   const page = await scraper.createPage(browser);
//   const { gameDetails, success, href } = await scraper.gameDetails(page, {
//     href: singleGame
//   });
//   await scraper.closeBrowser(browser);
// })()

(async () => {
  const fd = fs.openSync(output, 'a');
  fs.ftruncateSync(fd);

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
      console.log(`game details progress - ${count} of ${games.length} (${fullGames})`);
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
    }
    fs.fsyncSync(fd);
    console.log(`Games Loaded ${fullGames.length} - ${bookmark}`)
  }

  await scraper.closeBrowser(browser);
  fs.closeSync(fd);
})()
.catch(err => {
  console.log(err);
  process.exit(1);
});
