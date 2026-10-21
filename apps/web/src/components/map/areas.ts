export interface AreaPoint {
  key: string;
  lon: number;
  lat: number;
  count: number;
}

/** Members are largest first; the key is the lone member's key, or `area:` plus the largest. */
export interface Area {
  key: string;
  members: string[];
  lon: number;
  lat: number;
  count: number;
}

type Project = (lon: number, lat: number) => { x: number; y: number };

const CIRCLE_MIN_PX = 5;
const CIRCLE_MAX_PX = 28;
const AREA_MAX_PX = 40;

export function circleRadius(count: number, maxCount: number, isArea: boolean): number {
  const r = Math.max(CIRCLE_MIN_PX, CIRCLE_MAX_PX * Math.sqrt(count / maxCount));
  return isArea ? Math.min(AREA_MAX_PX, r) : r;
}

const TILE_PX = 512;
const MAX_LAT = 85.0511;

/**
 * Web Mercator pixels at a zoom. Distances between two points depend on the zoom alone, never on
 * pan, bearing or pitch, so a grouping built on it only changes when the zoom does.
 */
export function mercatorAt(zoom: number): Project {
  const size = TILE_PX * 2 ** zoom;
  return (lon, lat) => {
    const sin = Math.sin((Math.max(-MAX_LAT, Math.min(MAX_LAT, lat)) * Math.PI) / 180);
    return {
      x: ((lon + 180) / 360) * size,
      y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
    };
  };
}

function byRank(a: AreaPoint, b: AreaPoint): number {
  if (a.count !== b.count) return b.count - a.count;
  return a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
}

interface Group {
  anchor: AreaPoint;
  x: number;
  y: number;
  members: AreaPoint[];
  count: number;
  r: number;
}

/**
 * `size` returns the count behind a group's drawn circle when that is not the summed count,
 * e.g. the largest per-server sum when each server is drawn separately.
 */
export function groupIntoAreas(
  points: AreaPoint[],
  project: Project,
  maxCount: number,
  size?: (memberKeys: string[]) => number
): Area[] {
  const radius = (members: AreaPoint[], count: number) =>
    circleRadius(size ? size(members.map((m) => m.key)) : count, maxCount, members.length > 1);
  let groups: Group[] = [...points].sort(byRank).map((p) => ({
    anchor: p,
    ...project(p.lon, p.lat),
    members: [p],
    count: p.count,
    r: radius([p], p.count),
  }));
  // Merging grows a circle, which can reach a group it missed, so repeat until a pass merges nothing.
  for (;;) {
    const merged: Group[] = [];
    for (const g of groups) {
      const into = merged.find((m) => Math.hypot(m.x - g.x, m.y - g.y) < m.r + g.r);
      if (into) {
        into.members.push(...g.members);
        into.count += g.count;
        into.r = radius(into.members, into.count);
      } else {
        merged.push(g);
      }
    }
    if (merged.length === groups.length) break;
    groups = merged;
  }
  return groups.map(({ anchor, members, count }) => {
    const keys = members.sort(byRank).map((m) => m.key);
    return {
      key: keys.length > 1 ? `area:${anchor.key}` : anchor.key,
      members: keys,
      lon: anchor.lon,
      lat: anchor.lat,
      count,
    };
  });
}
