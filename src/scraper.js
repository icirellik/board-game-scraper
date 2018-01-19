import puppeteer from 'puppeteer';
import Q, { race } from 'q';
import url from 'url';
import {
  performance
} from 'perf_hooks';

module.exports.createBrowser = async () => {
  return await puppeteer.launch();
};

module.exports.createPage = async (browser) => {
  const page = await browser.newPage();
  page.on('console', msg => console.log('PAGE LOG:', msg.text));
  return page;
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
    const data = await page.evaluate(game => {
      const root = document.querySelector('div.game:not(.game-loading)');
      const details = Array.from(root.querySelectorAll('.game-header-body .gameplay .gameplay-item'));

      const players = details[0].querySelectorAll('.gameplay-item-primary span span');
      const minimumPlayers = (players.length > 0) ? players[0].textContent.trim() : 0;
      const maximunPlayers = (players.length > 1) ? players[1].textContent.trim().substring(1) : minimumPlayers;

      const playLength = details[1].querySelectorAll('div span span span');
      const minimumTime = (playLength.length > 0) ? playLength[0].textContent.trim() : 0;
      const maximumTime = (playLength.length > 1) ? playLength[1].textContent.trim().substring(1) : minimumTime;

      // Game credits
      const gameCredits = Array.from(root.querySelectorAll('.game-header .game-header-credits .credits ul li'));
      let artists = [];
      let designers = [];
      let publishers = [];
      for (const gameCredit of gameCredits) {
        const label = gameCredit.querySelector('strong');

        // Designers
        if (label && label.textContent && label.textContent.search(/Designer/g) !== -1) {
          const rawDesigners = Array.from(gameCredit.querySelectorAll('span a'));
          for (const rawDesigner of rawDesigners) {
            designers.push(rawDesigner.textContent.trim());
          }
        }

        // Artists
        else if (label && label.textContent && label.textContent.search(/Artist/g) !== -1) {
          const rawArtists = Array.from(gameCredit.querySelectorAll('span a'));
          for (const rawArtist of rawArtists) {
            artists.push(rawArtist.textContent.trim());
          }
        }

        // Publishers
        else if (label && label.textContent && label.textContent.search(/Publisher/g) !== -1) {
          const rawPublihers = Array.from(gameCredit.querySelectorAll('span a'));
          for (const rawPublisher of rawPublihers) {
            publishers.push(rawPublisher.textContent.trim());
          }
        }

      }

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
          designers,
          artists,
          publishers,
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
