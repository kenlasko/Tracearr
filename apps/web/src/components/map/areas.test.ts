import { describe, expect, it } from 'vitest';
import { type AreaPoint, circleRadius, groupIntoAreas } from './areas';

const flat = (lon: number, lat: number) => ({ x: lon, y: lat });

function point(key: string, lon: number, lat: number, count: number): AreaPoint {
  return { key, lon, lat, count };
}

describe('circleRadius', () => {
  it('draws the top place at 28 px, a tiny one at 5 px and caps an area at 40 px', () => {
    expect(circleRadius(412, 412, false)).toBe(28);
    expect(circleRadius(1, 412, false)).toBe(5);
    expect(circleRadius(100_000, 412, true)).toBe(40);
  });
});

describe('groupIntoAreas', () => {
  it('merges two overlapping circles into one area anchored at the larger place', () => {
    const big = point('big', 0, 0, 100);
    const small = point('small', 40, 0, 25);
    expect(groupIntoAreas([small, big], flat, 100)).toEqual([
      { key: 'area:big', members: ['big', 'small'], lon: 0, lat: 0, count: 125 },
    ]);
  });

  it('keeps places that do not touch apart under their own keys', () => {
    const areas = groupIntoAreas([point('a', 0, 0, 100), point('b', 100, 0, 25)], flat, 100);
    expect(areas.map((a) => [a.key, a.members])).toEqual([
      ['a', ['a']],
      ['b', ['b']],
    ]);
  });

  it('pulls in a third place that only the grown area circle reaches', () => {
    const a = point('a', 0, 0, 100);
    const b = point('b', 0, 40, 40);
    const c = point('c', 50, 0, 50);
    expect(groupIntoAreas([a, b, c], flat, 100)).toEqual([
      { key: 'area:a', members: ['a', 'c', 'b'], lon: 0, lat: 0, count: 190 },
    ]);
  });

  it('sizes circles from the sizing input when it is given', () => {
    const points = [point('a', 0, 0, 100), point('b', 45, 0, 100)];
    const perServer = (keys: string[]) => 50 * keys.length;
    expect(groupIntoAreas(points, flat, 100)).toHaveLength(1);
    expect(groupIntoAreas(points, flat, 100, perServer).map((a) => a.key)).toEqual(['a', 'b']);
  });

  it('always merges places on the same coordinate', () => {
    const areas = groupIntoAreas([point('x', 5, 5, 1), point('y', 5, 5, 1)], flat, 1000);
    expect(areas.map((a) => a.members)).toEqual([['x', 'y']]);
  });

  it('returns the same grouping for any input order', () => {
    const points = [
      point('a', 0, 0, 100),
      point('b', 0, 40, 40),
      point('c', 50, 0, 50),
      point('d', 300, 0, 10),
      point('e', 305, 0, 10),
      point('f', 600, 0, 3),
    ];
    const expected = groupIntoAreas(points, flat, 100);
    expect(groupIntoAreas([...points].reverse(), flat, 100)).toEqual(expected);
    expect(
      groupIntoAreas(
        [points[3]!, points[5]!, points[0]!, points[4]!, points[2]!, points[1]!],
        flat,
        100
      )
    ).toEqual(expected);
  });
});
