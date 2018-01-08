const puppeteer = require('puppeteer');
const scraper = require('./src/scraper');

const gameBrowseRoot = 'https://boardgamegeek.com/browse/boardgame';
// const gameBrowseRoot = 'https://boardgamegeek.com/browse/boardgame/page/958';

(async () => {
    const browser = await scraper.createBrowser();
    const page = await scraper.createPage(browser);

    let bookmark = gameBrowseRoot;
    let fullGames = [];
    while (!!bookmark) {
        const { games, nextUrl } = await scraper.gameList(page, bookmark);

        fullGames = fullGames.concat(games);
        bookmark = nextUrl;

        // Get all game details
        let count = 0;
        for (let game of games) {
            count = count + 1;
            console.log(`game details - ${count} \ ${fullGames.length}`);
            const gameDetails = await scraper.gameDetails(page, game);
            fullGames.push(gameDetails);
        }

        console.log(`Games Loaded ${fullGames.length} - ${bookmark}`)
    }

    await scraper.closeBrowser(browser);
})()
.catch(err => {
    console.log(err);
    process.exit(1);
});