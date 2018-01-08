const puppeteer = require('puppeteer');

module.exports.createBrowser = async () => {
    return await puppeteer.launch();
};

module.exports.createPage = async (browser) => {
    return await browser.newPage();
};

module.exports.closeBrowser = async (browser) => {
    await browser.close();
};

module.exports.gameList = async (page, browseUrl) => {
    let pageUrl = browseUrl;
    let allGames = [];
    let pages = 0;
    while (!!pageUrl) {

        await page.goto(pageUrl);

        // Selector for the 'next page' link.
        const nextSelector = 'div.infobox a';

        // Selector for the 'game list'.
        const gameListSelector = '.collection_table tr';

        // Wait for the page to load.
        await page.waitForSelector(nextSelector);
        await page.waitForSelector(gameListSelector);

        const pageData = await page.evaluate((nextSelector, gameListSelector) => {

            // Next Page Check.
            const pageAnchors = Array.from(document.querySelectorAll(nextSelector));
            const nextPageAnchor = pageAnchors
                .filter(anchor => anchor.title === 'next page')
                .map(anchor => anchor.href);

            // Game List.
            const rows = Array.from(document.querySelectorAll(gameListSelector));
            const games = rows.filter(row => {
                return !!row.querySelector('.collection_objectname a');
            }).map(row => {
                const anchor = row.querySelector('.collection_objectname a');
                const rating = Array.from(row.querySelectorAll('.collection_bggrating'));
                return {
                    name: anchor.textContent,
                    href: anchor.href,
                    avgerageRating: rating[1].textContent.trim(),
                    votes: rating[2].textContent.trim(),
                };
            });

            return {
                games,
                hasNext: nextPageAnchor.length !== 0,
                next: (nextPageAnchor.length !== 0) ? nextPageAnchor[0].trim() : '',
            }
        }, nextSelector, gameListSelector);

        allGames = allGames.concat(pageData.games)

        pages = pages + 1;
        console.log(`Page ${pages} - ${allGames.length} - ${pageUrl}`)

        if (pageData.hasNext) {
            pageUrl = pageData.next;
        } else {
            pageUrl = null;
        }
        console.log(`Browsing to  - ${pageUrl}`);
    }
    return allGames;
};

module.exports.gameDetails = async (page, game) => {
    console.log(game.href);
    await page.goto(game.href);
    await page.waitForSelector('.game-header-body');
    const gameData = await page.evaluate((game) => {
        const details = Array.from(document.querySelectorAll('.game-header-body .gameplay .gameplay-item'));

        const players = details[0].querySelectorAll('.gameplay-item-primary span span');
        const minimumPlayers = (players.length > 0) ? players[0].textContent.trim() : 0;
        const maximunPlayers = (players.length > 1) ? players[1].textContent.trim().substring(1) : minimumPlayers;

        const times = details[1].querySelectorAll('div span span span');
        const minimumTime = (times.length > 0) ? times[0].textContent.trim() : 0;
        const maximumTime = (times.length > 1) ? times[1].textContent.trim().substring(1) : minimumTime;

        return {
            title: game.name,
            averageRating: game.averageRating,
            votes: game.votes,
            age: details[2].querySelector('div span').textContent.trim(),
            players: {
                maximun: maximunPlayers,
                minimum: minimumPlayers,
            },
            time: {
                maximun: maximumTime,
                minimum: minimumTime,
            },
            weight: details[3].querySelector('div span span').textContent.trim(),
            features: {

            },
            designers: [

            ],
            artists: [

            ],
            publishers: [

            ],
        };
    }, game);
    console.log(gameData);
    return gameData;
};