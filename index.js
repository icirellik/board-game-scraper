const puppeteer = require('puppeteer');
const scraper = require('./src/scraper');

// const gameBrowseRoot = 'https://boardgamegeek.com/browse/boardgame';
const gameBrowseRoot = 'https://boardgamegeek.com/browse/boardgame/page/959';

(async () => {
    const browser = await scraper.createBrowser();
    const page = await scraper.createPage(browser);

    const games = await scraper.gameList(page, gameBrowseRoot);

    // Get all game details
    for (let game of games) {
        const gameDetails = await scraper.gameDetails(page, game);
    }

    await scraper.closeBrowser(browser);
})()
.catch(err => {
    console.log(err);
    process.exit(1);
});
