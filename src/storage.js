import fs from 'fs';
import { basename } from 'path';

const BASE_PATH_KEY = 'basePath';
const BASE_PATH_PREFIX = 'bgg-details'
const GAME_DETAILS_FILE = 'game-details.txt';
const GAMES_LOADED_FILE = 'games-loaded.json';

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
export const setPrefix = newPrefix => {
  prefix = newPrefix + '-';
}

/**
 * Set the resuming flag.
 *
 * @param {*} isResuming
 */
export const setResume = isResuming => {
  resuming = isResuming;
}

/**
 * Determines the next base path.
 */
export const determineBasePath = () => {
  let i = 1;
  while (fs.existsSync(`${prefix}${BASE_PATH_PREFIX}.${i}`)) {
    i++;
  }
  return `${prefix}${BASE_PATH_PREFIX}.${(resuming) ? i - 1 : i}`;
}

/**
 * Determines the base file path.
 */
export const filePath = (() => {
  // Determine the base directory.
  let filePaths = {}

  return fileName => {
    if (!(BASE_PATH_KEY in filePaths)) {
      filePaths[BASE_PATH_KEY] = determineBasePath();
    }

    if (!(fileName in filePaths)) {
      filePaths[fileName] = `${filePaths[BASE_PATH_KEY]}/${fileName}`;
    }
    return filePaths[fileName];
  }
})();

/**
 * Loads the list of previously loaded games.
 */
export const readLoaded = () => {
  ensureBasePath();
  const path = filePath(GAMES_LOADED_FILE);
  let loadedGames = [];
  if (fs.existsSync(path)) {
     return JSON.parse(fs.readFileSync(path));
  }
  return [];
}

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
}

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
}

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
    for (let gameDetail of gameDetails) {
      fs.appendFileSync(fd, JSON.stringify(gameDetail) + '\n');
    }
    fs.fdatasyncSync(fd);
  };
})();
