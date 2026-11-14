import assert from "node:assert/strict";
import test from "node:test";
import { calculateCellSize, generateShape, hasEnclosedHoles, isConnected, validateGridDimensions, validateRange } from "../generator.mjs";

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

test("validates positive integer ranges", () => {
  assert.deepEqual(validateRange(3, 25), { minTiles: 3, maxTiles: 25 });
  assert.deepEqual(validateRange(1, 200), { minTiles: 1, maxTiles: 200 });
  assert.throws(() => validateRange(0, 25), RangeError);
  assert.throws(() => validateRange(2.5, 25), RangeError);
  assert.throws(() => validateRange(8, 7), RangeError);
  assert.throws(() => validateRange(1, 201), RangeError);
});

test("validates positive integer grid dimensions", () => {
  assert.deepEqual(validateGridDimensions(20, 30), { rows: 20, columns: 30 });
  assert.throws(() => validateGridDimensions(0, 30), RangeError);
  assert.throws(() => validateGridDimensions(20, 201), RangeError);
  assert.throws(() => validateGridDimensions(2.5, 30), RangeError);
});

test("sizes square grid cells to keep the full configured grid inside the viewport", () => {
  assert.equal(calculateCellSize(1200, 800, 20, 30), 40);
  assert.equal(calculateCellSize(1200, 800, 10, 20), 60);
  assert.equal(calculateCellSize(1200, 800, 40, 40), 20);
  assert.throws(() => calculateCellSize(0, 800, 20, 30), RangeError);
});

test("chooses both inclusive tile-count boundaries", () => {
  assert.equal(generateShape({ minTiles: 3, maxTiles: 25, random: () => 0 }).tileCount, 3);
  assert.equal(generateShape({ minTiles: 3, maxTiles: 25, random: () => 0.999999 }).tileCount, 25);
  assert.equal(generateShape({ minTiles: 12, maxTiles: 12, random: () => 0.5 }).tileCount, 12);
});

test("rejects random values outside the supported interval", () => {
  assert.throws(() => generateShape({ minTiles: 2, maxTiles: 3, random: () => 1 }), RangeError);
  assert.throws(() => generateShape({ minTiles: 2, maxTiles: 3, random: () => Number.NaN }), RangeError);
});

test("every generated room has the requested count, stays connected, and has no holes", () => {
  for (let seed = 1; seed <= 60; seed += 1) {
    const shape = generateShape({ minTiles: 3, maxTiles: 25, random: seededRandom(seed) });
    assert.equal(shape.tiles.length, shape.tileCount);
    assert.ok(shape.tileCount >= 3 && shape.tileCount <= 25);
    assert.equal(new Set(shape.tiles.map(({ x, y }) => `${x},${y}`)).size, shape.tiles.length);
    assert.ok(shape.tiles.every(({ x, y }) => Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0));
    assert.equal(isConnected(shape.tiles), true, `seed ${seed} should be connected`);
    assert.equal(hasEnclosedHoles(shape.tiles), false, `seed ${seed} should not contain a hole`);
  }
});

test("bounded generation fits the visible grid and adapts to its available cells", () => {
  const shape = generateShape({
    minTiles: 25,
    maxTiles: 25,
    maxWidth: 5,
    maxHeight: 5,
    random: seededRandom(88),
  });
  assert.equal(shape.tileCount, 25);
  assert.ok(Math.max(...shape.tiles.map(({ x }) => x)) < 5);
  assert.ok(Math.max(...shape.tiles.map(({ y }) => y)) < 5);
  assert.equal(isConnected(shape.tiles), true);
  assert.equal(hasEnclosedHoles(shape.tiles), false);

  const adapted = generateShape({
    minTiles: 20,
    maxTiles: 25,
    maxWidth: 4,
    maxHeight: 4,
    random: seededRandom(89),
  });
  assert.equal(adapted.tileCount, 16);
  assert.equal(isConnected(adapted.tiles), true);
});

test("generation produces varied outlines for a fixed tile count", () => {
  const shapes = new Set();
  for (let seed = 1; seed <= 30; seed += 1) {
    const shape = generateShape({ minTiles: 12, maxTiles: 12, random: seededRandom(seed) });
    const canonical = shape.tiles.map(({ x, y }) => `${x},${y}`).sort().join(";");
    shapes.add(canonical);
  }

  assert.ok(shapes.size >= 15, `expected varied outlines, got ${shapes.size}`);
});

test("fixed-size rooms favor broader footprints over long narrow corridors", () => {
  let densityTotal = 0;
  let longNarrowRooms = 0;

  for (let seed = 1; seed <= 80; seed += 1) {
    const { tiles } = generateShape({ minTiles: 25, maxTiles: 25, random: seededRandom(seed) });
    const width = Math.max(...tiles.map(({ x }) => x)) + 1;
    const height = Math.max(...tiles.map(({ y }) => y)) + 1;
    densityTotal += tiles.length / (width * height);
    if (Math.min(width, height) <= 2 && Math.max(width, height) >= 8) longNarrowRooms += 1;
  }

  assert.ok(densityTotal / 80 >= 0.58, `expected broader footprints, mean density was ${densityTotal / 80}`);
  assert.ok(longNarrowRooms <= 4, `expected fewer long corridors, got ${longNarrowRooms} of 80`);
});

test("large rooms grow into two broad areas joined by a corridor", () => {
  for (let seed = 1; seed <= 12; seed += 1) {
    const { tiles } = generateShape({
      minTiles: 100,
      maxTiles: 100,
      maxWidth: 60,
      maxHeight: 30,
      random: seededRandom(seed),
    });
    const width = Math.max(...tiles.map(({ x }) => x)) + 1;
    const columnCounts = Array.from({ length: width }, () => 0);
    for (const tile of tiles) columnCounts[tile.x] += 1;
    const peaks = columnCounts
      .map((count, x) => ({ count, x }))
      .filter(({ count }) => count >= 5)
      .sort((a, b) => b.count - a.count);

    assert.equal(tiles.length, 100);
    assert.equal(isConnected(tiles), true);
    assert.equal(hasEnclosedHoles(tiles), false);
    assert.ok(peaks.some((first) => peaks.some((second) => Math.abs(first.x - second.x) >= 5)));
  }
});

test("connectivity uses shared edges rather than diagonal contact", () => {
  assert.equal(isConnected([{ x: 0, y: 0 }, { x: 1, y: 0 }]), true);
  assert.equal(isConnected([{ x: 0, y: 0 }, { x: 1, y: 1 }]), false);
  assert.equal(isConnected([{ x: 0, y: 0 }, { x: 0, y: 0 }]), false);
});

test("hole detection catches a closed center and allows an open outline", () => {
  const ring = [
    { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 },
    { x: 0, y: 1 }, { x: 2, y: 1 },
    { x: 0, y: 2 }, { x: 1, y: 2 }, { x: 2, y: 2 },
  ];
  const openRing = ring.filter(({ x, y }) => !(x === 1 && y === 2));

  assert.equal(hasEnclosedHoles(ring), true);
  assert.equal(hasEnclosedHoles(openRing), false);
});
