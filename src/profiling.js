import {
  performance
} from 'perf_hooks';

/**
 * Marks the start of a measure.
 * @param {*} mark
 */
export const markStart = mark => {
  performance.mark(`${mark}Start`);
};

/**
 * Marks the end and logs the timing for the measure.
 * @param {*} mark
 */
export const markEnd = mark => {
  performance.mark(`${mark}End`);
  performance.measure(`${mark}`, `${mark}Start`, `${mark}End`);
  const measure = performance.getEntriesByName(`${mark}`)[0];
  console.log(`${mark} - ${measure.duration}`);
  performance.clearMarks(`${mark}Start`);
  performance.clearMarks(`${mark}End`);
  performance.clearMeasures(`${mark}`);
};
