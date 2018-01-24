import fs from 'fs';
import { basename } from 'path';

const BASE_PATH_KEY = 'basePath';
const BASE_PATH_PREFIX = 'bgg-details';
const GAME_DETAILS_FILE = 'game-details.txt';
const GAME_RATINGS_FILE = 'game-ratings.txt';
const GAMES_LOADED_FILE = 'games-loaded.json';
const GAMES_LOADED_RATINGS_FILE = 'ratings-loaded.json';

let prefix = '';
let resuming = false;

/**
 * Makes sure that the base path exists.
 */
function ensureBasePath() {
  if (!fs.existsSync(filePath(BASE_PATH_KEY))) {
    fs.mkdirSync(filePath(BASE_PATH_KEY));
  }
}

/**
 * Can be used to set a folder prefix.
 *
 * @param {*} newPrefix
 */
export const setPrefix = (newPrefix) => {
  prefix = `${newPrefix}-`;
};

/**
 * Set the resuming flag.
 *
 * @param {*} isResuming
 */
export const setResume = (isResuming) => {
  resuming = isResuming;
};

/**
 * Determines the next base path.
 */
export const determineBasePath = () => {
  let i = 1;
  while (fs.existsSync(`${prefix}${BASE_PATH_PREFIX}.${i}`)) {
    i++;
  }
  return `${prefix}${BASE_PATH_PREFIX}.${(resuming) ? i - 1 : i}`;
};

/**
 * Determines the base file path.
 */
export const filePath = (() => {
  // Determine the base directory.
  const filePaths = {};

  return (fileName) => {
    if (!(BASE_PATH_KEY in filePaths)) {
      filePaths[BASE_PATH_KEY] = determineBasePath();
    }

    if (!(fileName in filePaths)) {
      filePaths[fileName] = `${filePaths[BASE_PATH_KEY]}/${fileName}`;
    }
    return filePaths[fileName];
  };
})();

/**
 * Loads the list of previously loaded games.
 */
export const readLoaded = () => {
  ensureBasePath();
  const path = filePath(GAMES_LOADED_FILE);
  if (fs.existsSync(path)) {
    return JSON.parse(fs.readFileSync(path));
  }
  return [];
};

/**
 * Appends a new set of game to the output files.
 *
 * @param {!Array<number>} loadedGames
 */
export const appendLoaded = (loadedGames) => {
  if (loadedGames.length === 0) {
    return;
  }
  ensureBasePath();
  const path = filePath(GAMES_LOADED_FILE);
  const currentLoaded = readLoaded();
  if (fs.existsSync(path)) {
    fs.truncateSync(path);
  }
  fs.writeFileSync(path, JSON.stringify(currentLoaded.concat(loadedGames)));
};

/**
 * Loads the list of previously loaded ratings.
 */
export const readLoadedRatings = () => {
  ensureBasePath();
  const path = filePath(GAMES_LOADED_RATINGS_FILE);
  if (fs.existsSync(path)) {
    return JSON.parse(fs.readFileSync(path));
  }
  return [];
};

export const appendLoadedRating = gameId => appendLoadedRatings([gameId]);

/**
 * Appends a new set of ratings to the output files.
 *
 * @param {!Array<number>} loadedRatings
 */
export const appendLoadedRatings = (loadedRatings) => {
  const currentLoaded = readLoadedRatings();
  if (loadedRatings.length === 0) {
    return currentLoaded;
  }
  ensureBasePath();
  const path = filePath(GAMES_LOADED_RATINGS_FILE);
  if (fs.existsSync(path)) {
    fs.truncateSync(path);
  }
  const ratings = currentLoaded.concat(loadedRatings);
  fs.writeFileSync(path, JSON.stringify(ratings));
  return ratings;
};

/**
 * Writes out the full list of loaded games after truncating the file.
 *
 * @param {!Array<number>} loadedGames
 */
export const writeLoaded = (loadedGames) => {
  if (loadedGames.length === 0) {
    return;
  }
  ensureBasePath();
  const path = filePath(GAMES_LOADED_FILE);
  if (fs.existsSync(path)) {
    fs.truncateSync(path);
  }
  fs.writeFileSync(path, JSON.stringify(loadedGames));
};

/**
 * Appends a list of individual game details to disk.
 *
 * @param {!Array<string>} gamesDetails
 */
export const appendDetails = (() => {
  let fd;
  return (gameDetails) => {
    if (gameDetails.length === 0) {
      return;
    }
    if (!fd) {
      ensureBasePath();
      fd = fs.openSync(filePath(GAME_DETAILS_FILE), 'a');
    }
    for (const gameDetail of gameDetails) {
      fs.appendFileSync(fd, `${JSON.stringify(gameDetail)}\n`);
    }
    fs.fdatasyncSync(fd);
  };
})();

/**
 * Appends a list of individual game ratings to disk.
 *
 * @param {!Array<string>} gameRatings
 */
export const appendRatings = (() => {
  let fd;
  return (gameRatings) => {
    if (!fd) {
      ensureBasePath();
      fd = fs.openSync(filePath(GAME_RATINGS_FILE), 'a');
    }
    fs.appendFileSync(fd, `${JSON.stringify(gameRatings)}\n`);
    fs.fdatasyncSync(fd);
  };
})();
