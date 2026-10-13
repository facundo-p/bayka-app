import { enTramos } from '../tramos';

test('enTramos corta de a N y deja el resto en el último', () => {
  expect(enTramos([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  expect(enTramos([], 2)).toEqual([]);
});
