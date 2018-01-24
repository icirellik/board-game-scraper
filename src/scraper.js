import axios from 'axios';
import puppeteer from 'puppeteer';
import Q from 'q';
import url from 'url';

import {
  markStart,
  markEnd,
} from './profiling';

let requestCache = {};

/**
 * Creates a new puppeteer browser.
 */
export const createBrowser = async () => {
  return await puppeteer.launch();
};

export const createPage = async (browser) => {
  const page = await browser.newPage();
  await page.setRequestInterception(true);
  await page.setJavaScriptEnabled(true);
  page.on('request', interceptedRequest => {
    const interceptedRequestUrl = url.parse(interceptedRequest.url);
    if (interceptedRequest.resourceType === 'image' ||
        interceptedRequest.resourceType === 'font' ||
        interceptedRequest.resourceType === 'stylesheet' ||
        interceptedRequest.url.search(/geekdo\.com\/api\/hotness/g) !== -1 ||
        interceptedRequest.url.search(/geekdo\.com\/api\/geeklists/g) !== -1 ||
        interceptedRequest.url.search(/geekdo\.com\/api\/images/g) !== -1 ||
        interceptedRequest.url.search(/geekdo\.com\/api\/forums/g) !== -1 ||
        interceptedRequest.url.search(/geekdo\.com\/api\/files/g) !== -1 ||
        interceptedRequest.url.search(/geekdo\.com\/api\/geekbay/g) !== -1 ||
        interceptedRequest.url.search(/geekdo\.com\/api\/geekmarket/g) !== -1 ||
        interceptedRequest.url.search(/geekdo\.com\/api\/fans/g) !== -1 ||
        interceptedRequest.url.search(/geekdo\.com\/api\/videos/g) !== -1 ||
        interceptedRequest.url.search(/geekdo\.com\/api\/collections/g) !== -1 ||
        interceptedRequest.url.search(/geekdo\.com\/api\/subscriptions/g) !== -1 ||
        // interceptedRequest.url.search(/geekitem.*\.js/g) !== -1 ||
        interceptedRequest.url.search(/\/api\/geekads/g) !== -1 ||
        interceptedRequest.url.search(/\/amazon\//g) !== -1 ||
        interceptedRequest.url.search(/amazon-adsystem/g) !== -1 ||
        interceptedRequest.url.search(/newrelic\.com/g) !== -1 ||
        interceptedRequest.url.search(/youtube\.com/g) !== -1 ||
        interceptedRequest.url.search(/twitter/g) !== -1 ||
        interceptedRequestUrl.host.search(/google/g) !== -1
    ) {
      console.log(`ABORTED ${interceptedRequest.url}`);
      interceptedRequest.abort();
    // } else if (interceptedRequest.url in requestCache) {
      // interceptedRequest.respond(requestCache[interceptedRequest.url]);
    } else {
      console.log(`KEPT ${interceptedRequest.url}`)
      interceptedRequest.continue();
    }
  });
  // page.on('response', async response => {
  //   const data = {
  //     status: response.status,
  //     headers: response.headers,
  //     contentType: response.headers['content-type'],
  //     body: await response.text(),
  //   }
  //   // console.log(data)
  //   requestCache[response.url] = data;

  // });
  page.on('console', msg => console.log('PAGE LOG:', msg.text));
  return page;
};

/**
 * Closes an open puppeteer browser.
 *
 * @param {*} browser
 */
export const closeBrowser = async (browser) => {
  await browser.close();
};

export const gameList = async (page, browseUrl) => {
  markStart('gameList');
  return await Q.fcall(async () => {
    console.log(`--- fetching - ${browseUrl}`);
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
    markEnd('gameList');
    return data;
  });
};

export const gameDetails = async (page, game) => {
  markStart('gameDetails');
  return await Q.fcall(async () => {
    console.log(`--- fetching - ${game.href}`);
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

      // Game Categories
      const featureGroups = Array.from(root.querySelectorAll('.game-description-classification .panel-body ul li'));
      let types = [];
      let categories = [];
      let mechanisms = [];
      let families = [];
      for (const featureGroup of featureGroups) {
        const featureTitle = featureGroup.querySelector('.feature-title');
        // Type
        if (featureTitle && featureTitle.textContent && featureTitle.textContent.search(/Type/g) !== -1) {
          const rawType = featureGroup.querySelector('.feature-description span');
          types.push(rawType.textContent.trim());
        }
        // Category
        else if (featureTitle && featureTitle.textContent && featureTitle.textContent.search(/Category/g) !== -1) {
          const rawCategories = featureGroup.querySelectorAll('.feature-description span a');
          for (const rawCategory of rawCategories) {
            categories.push(rawCategory.textContent.trim());
          }
        }
        // Mechanisms
        else if (featureTitle && featureTitle.textContent && featureTitle.textContent.search(/Mechanisms/g) !== -1) {
          const rawMechanisms = featureGroup.querySelectorAll('.feature-description span a');
          for (const rawMechanism of rawMechanisms) {
            mechanisms.push(rawMechanism.textContent.trim());
          }
        }
        // Family
        else if (featureTitle && featureTitle.textContent && featureTitle.textContent.search(/Family/g) !== -1) {
          const rawFamilies = featureGroup.querySelectorAll('.feature-description span a');
          for (const rawFamily of rawFamilies) {
            families.push(rawFamily.textContent.trim());
          }
        }
      }

      return {
        details: {
          age: details[2].querySelector('div span').textContent.trim(),
          averageRating: game.averageRating,
          id: game.id,
          title: game.name,
          votes: game.votes,
          players: {
            maximum: maximunPlayers,
            minimum: minimumPlayers,
          },
          time: {
            maximum: maximumTime,
            minimum: minimumTime,
          },
          weight: details[3].querySelector('div span span').textContent.trim(),
          features: {
            categories,
            families,
            mechanisms,
            types,
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
      details: {},
      success: false,
    };
  })
  .then(data => {
    markEnd('gameDetails');
    return data;
  });
};

/**
 * Download all the ratings for a single game in paginated form.
 *
 * if rating is 0 and review_tstamp is null then don't include
 *
 * Sample url (Dinosaur Island):
 *
 * https://boardgamegeek.com/api/collections?ajax=1&objectid=221194&objecttype=thing&oneperuser=1&pageid=1&showcount=50&sort=review_tstamp
 *
 * Fields:
 * collid
 * objectid
 * rating
 * user.username
 * user.country
 * user.city
 * user.state
 * review_tstamp
 *
 * @param {*} gameId
 * @param {*} pageId
 */
export const gameRatings = async (gameId, pageId) => {
  markStart('gameRatings');

  const url = `https://boardgamegeek.com/api/collections?ajax=1&objectid=${gameId}&objecttype=thing&oneperuser=1&pageid=${pageId}&showcount=50&sort=review_tstamp`;
  console.log(`--- fetching - ${url}`);
  const ratings = await axios.get(url);

  const items = ratings.data.items
    .filter(rating => rating['rating_tstamp'] !== null)
    .map(rating => {
      return {
        id: rating.collid,
        gameId: rating.objectid,
        userId: rating.user.username,
        country: rating.user.country,
        city: rating.user.city,
        state: rating.user.state,
        rating: rating.rating,
        ratingDateTime: rating['rating_tstamp'],
      };
    });

  markEnd('gameRatings');
  return items;
};
