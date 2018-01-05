const puppeteer =  require('puppeteer');

const scheme = 'https://'
const site = 'boardgamegeek.com';
const browse = '/browse/boardgame';

(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(scheme + site + browse);

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

        const gameSelector = '.collection_table .collection_objectname a';
        await page.waitForSelector(gameSelector);
        const games = await page.evaluate(gameSelector => {
            const anchors = Array.from(document.querySelectorAll(gameSelector));
            return anchors.map(anchor => {
                return {
                    anchor: anchor.href,
                    name: anchor.textContent
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
