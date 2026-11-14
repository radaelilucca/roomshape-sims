const DIRECTIONS = [
  { x: 1, y: 0 },
  { x: -1, y: 0 },
  { x: 0, y: 1 },
  { x: 0, y: -1 },
];
const MAX_TILE_COUNT = 200;

const keyOf = ({ x, y }) => `${x},${y}`;

export function validateRange(minTiles, maxTiles) {
  if (!Number.isSafeInteger(minTiles) || minTiles < 1 || minTiles > MAX_TILE_COUNT) {
    throw new RangeError(`Minimum tiles must be a whole number from 1 to ${MAX_TILE_COUNT}.`);
  }
  if (!Number.isSafeInteger(maxTiles) || maxTiles < 1 || maxTiles > MAX_TILE_COUNT) {
    throw new RangeError(`Maximum tiles must be a whole number from 1 to ${MAX_TILE_COUNT}.`);
  }
  if (minTiles > maxTiles) {
    throw new RangeError("Minimum tiles cannot be greater than maximum tiles.");
  }

  return { minTiles, maxTiles };
}

export function validateGridDimensions(rows, columns) {
  if (!Number.isSafeInteger(rows) || rows < 1 || rows > MAX_TILE_COUNT) {
    throw new RangeError(`Rows must be a whole number from 1 to ${MAX_TILE_COUNT}.`);
  }
  if (!Number.isSafeInteger(columns) || columns < 1 || columns > MAX_TILE_COUNT) {
    throw new RangeError(`Columns must be a whole number from 1 to ${MAX_TILE_COUNT}.`);
  }
  return { rows, columns };
}

export function calculateCellSize(viewportWidth, viewportHeight, rows, columns) {
  validateGridDimensions(rows, columns);
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) {
    throw new RangeError("Viewport width must be a positive number.");
  }
  if (!Number.isFinite(viewportHeight) || viewportHeight <= 0) {
    throw new RangeError("Viewport height must be a positive number.");
  }
  return Math.min(viewportWidth / columns, viewportHeight / rows);
}

function sample(random) {
  const value = random();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError("Random source must return a number from 0 inclusive to 1 exclusive.");
  }
  return value;
}

function boundsOf(tiles) {
  return tiles.reduce(
    (bounds, tile) => ({
      minX: Math.min(bounds.minX, tile.x),
      maxX: Math.max(bounds.maxX, tile.x),
      minY: Math.min(bounds.minY, tile.y),
      maxY: Math.max(bounds.maxY, tile.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );
}

export function isConnected(tiles) {
  if (!Array.isArray(tiles) || tiles.length === 0) return false;

  const occupied = new Set(tiles.map(keyOf));
  if (occupied.size !== tiles.length) return false;

  const visited = new Set();
  const queue = [tiles[0]];
  visited.add(keyOf(tiles[0]));

  for (let index = 0; index < queue.length; index += 1) {
    const tile = queue[index];
    for (const direction of DIRECTIONS) {
      const neighbor = { x: tile.x + direction.x, y: tile.y + direction.y };
      const key = keyOf(neighbor);
      if (occupied.has(key) && !visited.has(key)) {
        visited.add(key);
        queue.push(neighbor);
      }
    }
  }

  return visited.size === occupied.size;
}

export function hasEnclosedHoles(tiles) {
  if (!Array.isArray(tiles) || tiles.length === 0) return false;

  const occupied = new Set(tiles.map(keyOf));
  const bounds = boundsOf(tiles);
  const minX = bounds.minX - 1;
  const maxX = bounds.maxX + 1;
  const minY = bounds.minY - 1;
  const maxY = bounds.maxY + 1;
  const visited = new Set();
  const queue = [];

  for (let x = minX; x <= maxX; x += 1) {
    queue.push({ x, y: minY }, { x, y: maxY });
  }
  for (let y = minY + 1; y < maxY; y += 1) {
    queue.push({ x: minX, y }, { x: maxX, y });
  }

  for (const tile of queue) visited.add(keyOf(tile));

  for (let index = 0; index < queue.length; index += 1) {
    const tile = queue[index];
    for (const direction of DIRECTIONS) {
      const neighbor = { x: tile.x + direction.x, y: tile.y + direction.y };
      if (
        neighbor.x < minX || neighbor.x > maxX ||
        neighbor.y < minY || neighbor.y > maxY
      ) {
        continue;
      }

      const key = keyOf(neighbor);
      if (!occupied.has(key) && !visited.has(key)) {
        visited.add(key);
        queue.push(neighbor);
      }
    }
  }

  for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
    for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
      const key = `${x},${y}`;
      if (!occupied.has(key) && !visited.has(key)) return true;
    }
  }

  return false;
}

function neighborCount(tile, occupied) {
  return DIRECTIONS.reduce((count, direction) => {
    return count + Number(occupied.has(`${tile.x + direction.x},${tile.y + direction.y}`));
  }, 0);
}

function getFrontier(tiles, occupied, maxWidth, maxHeight) {
  const frontier = new Map();
  for (const tile of tiles) {
    for (const direction of DIRECTIONS) {
      const candidate = { x: tile.x + direction.x, y: tile.y + direction.y };
      if (candidate.x < 0 || candidate.x >= maxWidth || candidate.y < 0 || candidate.y >= maxHeight) {
        continue;
      }
      const key = keyOf(candidate);
      if (!occupied.has(key)) frontier.set(key, candidate);
    }
  }
  return [...frontier.values()];
}

function candidateWeight(candidate, tiles, occupied, random, largeRoomBias = null) {
  const contacts = neighborCount(candidate, occupied);
  // Favor filling out an existing room edge over extending a single-tile corridor.
  const contactWeight = [0, 0.55, 2.8, 2.25, 1.0][contacts];
  const nextBounds = boundsOf([...tiles, candidate]);
  const width = nextBounds.maxX - nextBounds.minX + 1;
  const height = nextBounds.maxY - nextBounds.minY + 1;
  const aspectRatio = Math.max(width, height) / Math.min(width, height);
  const aspectWeight = 1 / (1 + Math.max(0, aspectRatio - 1.6) * 0.34);
  const fillRatio = (tiles.length + 1) / (width * height);
  const outlineWeight = fillRatio === 1 && tiles.length >= 3
    ? 0.08
    : fillRatio > 0.88 && tiles.length >= 6
      ? 0.45
      : 1;

  let areaWeight = 1;
  if (largeRoomBias) {
    const along = largeRoomBias.horizontal ? candidate.x : candidate.y;
    const across = largeRoomBias.horizontal ? candidate.y : candidate.x;
    const anchorDistance = Math.min(...largeRoomBias.anchors.map((anchor) => Math.abs(along - anchor)));
    const corridorDistance = Math.abs(across - largeRoomBias.corridor);
    areaWeight = anchorDistance <= 2
      ? 2.2
      : corridorDistance === 1
        ? 0.28
        : 0.75;
  }

  return contactWeight * aspectWeight * outlineWeight * areaWeight * (0.65 + sample(random) * 0.7);
}

function chooseWeighted(candidates, tiles, occupied, random, largeRoomBias) {
  const weighted = candidates
    .map((tile) => ({ tile, weight: candidateWeight(tile, tiles, occupied, random, largeRoomBias) }))
    .filter(({ weight }) => weight > 0);
  const totalWeight = weighted.reduce((total, entry) => total + entry.weight, 0);
  let threshold = sample(random) * totalWeight;

  for (const entry of weighted) {
    threshold -= entry.weight;
    if (threshold < 0) return entry.tile;
  }

  return weighted.at(-1).tile;
}

export function generateShape({
  minTiles = 3,
  maxTiles = 25,
  maxWidth = Infinity,
  maxHeight = Infinity,
  random = Math.random,
} = {}) {
  const range = validateRange(minTiles, maxTiles);
  if (typeof random !== "function") {
    throw new TypeError("Random source must be a function.");
  }
  if (!(maxWidth === Infinity || (Number.isSafeInteger(maxWidth) && maxWidth > 0))) {
    throw new RangeError("Maximum width must be a positive whole number.");
  }
  if (!(maxHeight === Infinity || (Number.isSafeInteger(maxHeight) && maxHeight > 0))) {
    throw new RangeError("Maximum height must be a positive whole number.");
  }

  const capacity = maxWidth * maxHeight;
  const feasibleMax = Math.min(range.maxTiles, capacity);
  const feasibleMin = Math.min(range.minTiles, feasibleMax);
  const tileCount = feasibleMin === feasibleMax
    ? feasibleMin
    : feasibleMin + Math.floor(sample(random) * (feasibleMax - feasibleMin + 1));

  for (let attempt = 0; attempt < 32; attempt += 1) {
    const horizontal = maxWidth >= maxHeight;
    const axisSize = horizontal ? maxWidth : maxHeight;
    const corridorLength = tileCount > 50 && Number.isFinite(axisSize)
      ? Math.min(axisSize, Math.max(5, Math.floor(tileCount * 0.18)))
      : 1;
    const startAlong = Number.isFinite(axisSize) ? Math.floor((axisSize - corridorLength) / 2) : 0;
    const crossSize = horizontal ? maxHeight : maxWidth;
    const corridor = Number.isFinite(crossSize) ? Math.floor(crossSize / 2) : 0;
    const largeRoomBias = tileCount > 50 && corridorLength >= 5
      ? {
          horizontal,
          corridor,
          anchors: [startAlong, startAlong + corridorLength - 1],
        }
      : null;
    const tiles = [];
    const occupied = new Set();
    for (let offset = 0; offset < corridorLength; offset += 1) {
      const tile = horizontal
        ? { x: startAlong + offset, y: corridor }
        : { x: corridor, y: startAlong + offset };
      tiles.push(tile);
      occupied.add(keyOf(tile));
    }
    let stuck = false;

    while (tiles.length < tileCount) {
      const safeFrontier = getFrontier(tiles, occupied, maxWidth, maxHeight).filter((candidate) => {
        return !hasEnclosedHoles([...tiles, candidate]);
      });

      if (safeFrontier.length === 0) {
        stuck = true;
        break;
      }

      const next = chooseWeighted(safeFrontier, tiles, occupied, random, largeRoomBias);
      tiles.push(next);
      occupied.add(keyOf(next));
    }

    if (stuck) continue;

    const bounds = boundsOf(tiles);
    const normalizedTiles = tiles.map(({ x, y }) => ({
      x: x - bounds.minX,
      y: y - bounds.minY,
    }));

    return { tileCount, tiles: normalizedTiles };
  }

  throw new Error("Could not generate a room that fits inside the visible grid.");
}
