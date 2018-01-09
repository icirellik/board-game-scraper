const puppeteer = require('puppeteer');
const scraper = require('./src/scraper');

const gameBrowseRoot = 'https://boardgamegeek.com/browse/boardgame';

(async () => {
    const browser = await scraper.createBrowser();

    // Attach SIGINT handler with browser cleanup.
    process.on('SIGINT', async () => {
      console.log("Interrupted exiting.");
      await scraper.closeBrowser(browser);
      process.exit();
    });

    const page = await scraper.createPage(browser);

    let bookmark = gameBrowseRoot;
    let fullGames = [];
    while (!!bookmark) {
      const { games, nextUrl, success } = await scraper.gameList(page, bookmark);
      if (!success) {
        continue;
      }
      bookmark = nextUrl;

      // Get all game details
      let count = 1;
      for (let game of games) {
        console.log(`game details - ${count} \ ${fullGames.length}`);
        let fetchDetails = true;
        while (fetchDetails) {
          const { gameDetails, success, href } = await scraper.gameDetails(page, game);
          if (success) {
            fetchDetails = false;
            fullGames.push(gameDetails);
          }
        }
        count++;
      }
      console.log(`Games Loaded ${fullGames.length} - ${bookmark}`)
    }

    await scraper.closeBrowser(browser);
})()
.catch(err => {
  console.log(err);
  process.exit(1);
});
