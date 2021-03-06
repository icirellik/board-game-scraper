import fs from 'fs';
import rimraf from 'rimraf';
import {
  appendDetails,
  appendLoaded,
  appendLoadedRatings,
  appendRatings,
  determineBasePath,
  filePath,
  readLoaded,
  readLoadedRatings,
  setPrefix,
  writeLoaded,
} from '../storage';

const PREFIX = 'bgg-test';
setPrefix(PREFIX);

describe('storage works correctly', () => {
  afterEach(async () => {
    await rimraf.sync(`${PREFIX}-bgg-details.*`);
  });

  it('determines a base path', () => {
    const basePath = determineBasePath();
    expect(basePath).toBe(`${PREFIX}-bgg-details.1`);
  });

  it('determines a the correct next base path', async () => {
    const count = 5;
    for (let i = 1; i < count; i += 1) {
      fs.mkdirSync(`${PREFIX}-bgg-details.${i}`);
    }

    const basePath = determineBasePath();
    expect(basePath).toBe(`${PREFIX}-bgg-details.${count}`);

    for (let i = 1; i < count; i += 1) {
      fs.rmdirSync(`${PREFIX}-bgg-details.${i}`);
    }
  });

  it('determines the correct file paths', () => {
    const foo1 = filePath('foo.txt');
    const foo2 = filePath('foo.txt');
    const bar = filePath('bar.txt');
    const basePath = determineBasePath();

    expect(foo1).toBe(`${basePath}/foo.txt`);
    expect(foo1).toBe(`${basePath}/foo.txt`);
    expect(bar).toBe(`${basePath}/bar.txt`);
  });

  it('can read loaded games (first pass)', () => {
    const loaded = readLoaded();
    expect(loaded).toEqual([]);
  });

  it('can write loaded and read loaded game', () => {
    const ids = [1, 2, 5, 9];
    writeLoaded(ids);
    const loaded = readLoaded();
    expect(loaded).toEqual(ids);
  });

  it('can write loaded games (truncating)', () => {
    const ids = [1, 2, 5, 9];
    const moreIds = [4, 6, 9];
    writeLoaded(ids);
    writeLoaded(moreIds);
    const loaded = readLoaded();
    expect(loaded).toEqual(moreIds);
  });

  it('can append loaded games', () => {
    const ids = [1, 2, 5, 9];
    const moreIds = [4, 6, 9];
    appendLoaded(ids);
    appendLoaded(moreIds);
    const loaded = readLoaded();
    expect(loaded).toEqual(ids.concat(moreIds));
  });

  it('can write game details', () => {
    const gameDetails = [
      { apple: 1, banana: 2 },
      { apple: 2, banana: 3 },
    ];
    appendDetails(gameDetails);
    const data = fs.readFileSync(`${PREFIX}-bgg-details.1/game-details.txt`);
    let expected = '';
    gameDetails.forEach((gameDetail) => {
      expected += `${JSON.stringify(gameDetail)}\n`;
    });
    expect(data.toString()).toEqual(expected);
    const gameDetails2 = [
      { apple: 3, banana: 4 },
      { apple: 4, banana: 5 },
    ];
    appendDetails(gameDetails2);
    const data2 = fs.readFileSync(`${PREFIX}-bgg-details.1/game-details.txt`);
    gameDetails2.forEach((gameDetail) => {
      expected += `${JSON.stringify(gameDetail)}\n`;
    });
    expect(data2.toString()).toEqual(expected);
  });

  it('can read loaded ratings (first pass)', () => {
    const loaded = readLoadedRatings();
    expect(loaded).toEqual([]);
  });

  it('can write loaded rating and read them back', () => {
    const ids = [1, 2, 5, 9];
    appendLoadedRatings(ids);
    const loaded = readLoadedRatings();
    expect(loaded).toEqual(ids);
  });

  it('can write game ratings', () => {
    const ratings = {
      gameId: 1, ratings: [{}],
    };
    appendRatings(ratings);
    const data = fs.readFileSync(`${PREFIX}-bgg-details.1/game-ratings.txt`);
    let expected = `${JSON.stringify(ratings)}\n`;
    expect(data.toString()).toEqual(expected);

    const ratings2 = {
      gameId: 3, ratings: [{}],
    };
    appendRatings(ratings2);
    const data2 = fs.readFileSync(`${PREFIX}-bgg-details.1/game-ratings.txt`);
    expected += `${JSON.stringify(ratings2)}\n`;
    expect(data2.toString()).toEqual(expected);
  });
});
