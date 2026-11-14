# Tile Shape Generator MVP

## Goal

Build a small standalone browser app that generates varied, connected room footprints on a full-screen grid. The default tile range is 3 to 25 and grid cell size adapts to the configured rows and columns.

## User experience

- Show the generated room centered on a subtle full-screen grid; the default cell size is about 40 CSS pixels and adjusts to fit configured dimensions.
- Keep a compact floating card in the upper-right corner with the `G` and `S` shortcuts and the current room's tile count.
- Generate another room by clicking the grid or pressing `G`; open settings with the `S` key.
- Validate integer limits from 1 to 200, require minimum to be no greater than maximum, and retain saved limits in local storage.
- Let users set visible grid rows and columns from 1 to 200; resize every tile to fit the full configured grid within the window.
- Keep the grid fixed to the viewport with no scrolling and constrain each generated shape to the visible grid dimensions.

## Generation

Choose the tile count uniformly from the inclusive configured range, capped by the number of configured grid cells. Start from one cell and repeatedly select an unoccupied orthogonal neighbor. This construction keeps the shape connected at every step. For rooms over 50 tiles, seed a short central corridor and favor expansion around its endpoints to form multiple broad areas. For smaller rooms, weight frontier cells that touch two or three existing tiles more heavily than single-contact extensions. Reject placements that enclose empty cells, and retain penalties against filled rectangles and high aspect ratios. Limit configured ranges and grid dimensions to 200 to keep generation and rendering responsive.

Keep the generator independent of the DOM and accept an injected random function so tests can cover boundaries and repeatable sequences without dependencies.

## Files and verification

- `index.html`: semantic app structure and settings dialog.
- `styles.css`: minimal full-screen grid presentation.
- `app.js`: responsive grid sizing, rendering, controls, keyboard shortcuts, and local storage.
- `generator.mjs`: pure range validation and procedural generation.
- `tests/generator.test.mjs`: automated checks using Node's built-in test runner.
- `package.json`: `npm test` script; no runtime or development dependencies.

Run `npm test` to validate exact tile counts, range boundaries, viewport fitting, connectivity, hole avoidance, shape variation, and a broad-footprint bias across seeded 25-tile samples.
