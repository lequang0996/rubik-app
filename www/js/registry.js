import { Cube } from './cubes.js';
import { Pyraminx } from './pyraminx.js';
import { Skewb } from './skewb.js';

export const PUZZLES = [
  ['3x3', '3x3', () => new Cube(3)],
  ['2x2', '2x2', () => new Cube(2)],
  ['4x4', '4x4', () => new Cube(4)],
  ['5x5', '5x5', () => new Cube(5)],
  ['pyraminx', 'Pyraminx', () => new Pyraminx()],
  ['skewb', 'Skewb', () => new Skewb()],
];
const cache = {};
export function getPuzzle(key) {
  if (!cache[key]) cache[key] = PUZZLES.find((p) => p[0] === key)[2]();
  return cache[key].clone();
}
