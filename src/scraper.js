const puppeteer = require('puppeteer');
const Q = require('q');
const url = require('url');
const {
  performance
} = require('perf_hooks');

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
  performance.mark('gameListStart');
  return await Q.fcall(async () => {
    console.log(`scraping ${browseUrl}`);
    await page.goto(browseUrl);

    // Selector for the 'next page' link.
    const nextSelector = 'div.infobox a';

    // Selector for the 'game list'.
    const gameListSelector = '.collection_table tr';

    // Wait for the page to load.
    await page.waitForSelector(nextSelector);
    await page.waitForSelector(gameListSelector);
    const data = await page.evaluate((nextSelector, gameListSelector) => {
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
          avgerageRating: rating[1].textContent.trim(),
          href: anchor.href,
          name: anchor.textContent,
          votes: rating[2].textContent.trim(),
        };
      });

      return {
        games,
        hasNext: nextPageAnchor.length !== 0,
        next: (nextPageAnchor.length !== 0) ? nextPageAnchor[0].trim() : ''
      }
    }, nextSelector, gameListSelector);

    return {
      games: data.games,
      nextUrl: (data.hasNext) ? data.next : null,
      browseUrl,
      success: true,
    };
  })
  .catch(err => {
    console.log(`Failed to retrieve game details ${err}`);
    return {
      browseUrl,
      success: false,
    };
  })
  .then(data => {
    performance.mark('gameListEnd');
    performance.measure('gameList', 'gameListStart', 'gameListEnd');
    const measure = performance.getEntriesByName('gameList')[0];
    console.log(`gamesList - ${measure.duration}`);
    performance.clearMarks();
    performance.clearMeasures();
    return data;
  });
};

module.exports.gameDetails = async (page, game) => {
  performance.mark('gameDetailsStart');
  return await Q.fcall(async () => {
    console.log(`scraping - ${game.href}`);

    // Pull the game id out of the url.
    game.id = url.parse(game.href).pathname.split('/')[2];

    await page.goto(game.href);
    await page.waitForSelector('.game-header-body');
    const data = await page.evaluate((game,) => {
      const details = Array.from(document.querySelectorAll('.game-header-body .gameplay .gameplay-item'));

      const players = details[0].querySelectorAll('.gameplay-item-primary span span');
      const minimumPlayers = (players.length > 0) ? players[0].textContent.trim() : 0;
      const maximunPlayers = (players.length > 1) ? players[1].textContent.trim().substring(1) : minimumPlayers;

      const times = details[1].querySelectorAll('div span span span');
      const minimumTime = (times.length > 0) ? times[0].textContent.trim() : 0;
      const maximumTime = (times.length > 1) ? times[1].textContent.trim().substring(1) : minimumTime;

      return {
        gameDetails: {
          age: details[2].querySelector('div span').textContent.trim(),
          averageRating: game.averageRating,
          id: game.id,
          title: game.name,
          votes: game.votes,
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
        },
        href: game.href,
        success: true,
      };
    }, game)
    console.log(JSON.stringify(data));
    return data;
  })
  .catch(err => {
    return {
      browseUrl: game.href,
      gameDetails: {},
      success: false,
    };
  })
  .then(data => {
    performance.mark('gameDetailsEnd');
    performance.measure('gameDetails', 'gameDetailsStart', 'gameDetailsEnd');
    const measure = performance.getEntriesByName('gameDetails')[0];
    console.log(`gameDetails - ${measure.duration}`);
    performance.clearMarks();
    performance.clearMeasures();
    return data;
  });
};
