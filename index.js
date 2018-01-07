const puppeteer =  require('puppeteer');

const scheme = 'https://'
const site = 'boardgamegeek.com';
const browse = '/browse/boardgame';

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(scheme + site + browse);


    const singleGame = 'https://boardgamegeek.com/boardgame/192735/broom-service-card-game';
    await page.goto(singleGame);
    const gameData = await page.evaluate(() => {

        const details = Array.from(document.querySelectorAll('.game-header-body .gameplay .gameplay-item'));

        return {
            age: details[2].querySelector('div span').textContent.trim(),
            players: {
                maximun: details[0].querySelectorAll('div span span')[1].textContent.trim().substring(1),
                minimum: details[0].querySelectorAll('div span span')[0].textContent.trim(),
            },
            time: {
                maximun: details[1].querySelectorAll('div span span span')[1].textContent.trim().substring(1),
                minimum: details[1].querySelectorAll('div span span span')[0].textContent.trim(),
            },
            weight: details[3].querySelector('div span span').textContent.trim(),
        }
    });
    console.log(gameData);

    return;

    var running = true;
    var games = {};
    while (running) {

        // Check has 'Next'
        const nextSelector = 'div.infobox a';
        await page.waitForSelector(nextSelector);
        const nextButton = await page.evaluate(nextSelector => {
            const anchors = Array.from(document.querySelectorAll(nextSelector));
            return anchors.filter(anchor => anchor.title === 'next page')
                .map(anchor => anchor.href);
        }, nextSelector);

        // Find the list of games per page.
        const gameSelector = '.collection_table tr';
        // const gameSelector = '.collection_table .collection_objectname a';
        await page.waitForSelector(gameSelector);
        const games = await page.evaluate(gameSelector => {
            const rows = Array.from(document.querySelectorAll(gameSelector));
            return rows.filter(row => {
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
        }, gameSelector);
        console.log(games);

        if (nextButton.length !== 0) {
            await page.goto(nextButton[0]);
        } else {
            running = false;
        }
    }

    await browser.close();
})()
.catch(err => {
    console.log(err);
    exit(1);
});
