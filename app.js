import { calculateCellSize, generateShape, validateGridDimensions, validateRange } from "./generator.mjs";

const STORAGE_KEY = "roomshape.settings.v1";
const DEFAULT_CELL_SIZE = 40;

const board = document.querySelector("#board");
const gridCanvas = document.querySelector("#grid-canvas");
const tileCount = document.querySelector("#tile-count");
const openSettingsButton = document.querySelector("#open-settings");
const settingsDialog = document.querySelector("#settings-dialog");
const settingsForm = document.querySelector("#settings-form");
const minInput = document.querySelector("#min-tiles");
const maxInput = document.querySelector("#max-tiles");
const rowsInput = document.querySelector("#grid-rows");
const columnsInput = document.querySelector("#grid-columns");
const closeSettingsButton = document.querySelector("#close-settings");
const cancelSettingsButton = document.querySelector("#cancel-settings");

function defaultSettings() {
  return {
    minTiles: 3,
    maxTiles: 25,
    columns: Math.max(1, Math.min(200, Math.floor(window.innerWidth / DEFAULT_CELL_SIZE))),
    rows: Math.max(1, Math.min(200, Math.floor(window.innerHeight / DEFAULT_CELL_SIZE))),
  };
}

function validateSettings(values) {
  return {
    ...validateRange(values.minTiles, values.maxTiles),
    ...validateGridDimensions(values.rows, values.columns),
  };
}

function loadSettings() {
  const defaults = defaultSettings();
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (stored) {
      return validateSettings({
        minTiles: Number(stored.minTiles ?? defaults.minTiles),
        maxTiles: Number(stored.maxTiles ?? defaults.maxTiles),
        rows: Number(stored.rows ?? defaults.rows),
        columns: Number(stored.columns ?? defaults.columns),
      });
    }
  } catch {
    // Ignore unavailable storage or stale settings and use the defaults.
  }
  return defaults;
}

let settings = loadSettings();
let currentShape = null;
let resizeFrame = 0;

function getCellSize() {
  return calculateCellSize(board.clientWidth, board.clientHeight, settings.rows, settings.columns);
}

function renderShape(shape) {
  const cellSize = getCellSize();
  const minX = Math.min(...shape.tiles.map(({ x }) => x));
  const maxX = Math.max(...shape.tiles.map(({ x }) => x));
  const minY = Math.min(...shape.tiles.map(({ y }) => y));
  const maxY = Math.max(...shape.tiles.map(({ y }) => y));
  const shapeColumns = maxX - minX + 1;
  const shapeRows = maxY - minY + 1;
  const offsetX = Math.floor((settings.columns - shapeColumns) / 2) - minX;
  const offsetY = Math.floor((settings.rows - shapeRows) / 2) - minY;
  const fragment = document.createDocumentFragment();

  gridCanvas.style.width = `${settings.columns * cellSize}px`;
  gridCanvas.style.height = `${settings.rows * cellSize}px`;
  gridCanvas.style.setProperty("--grid-step", `${cellSize}px`);

  for (const [index, tile] of shape.tiles.entries()) {
    const element = document.createElement("span");
    element.className = "room-tile";
    element.setAttribute("aria-hidden", "true");
    element.style.left = `${(tile.x + offsetX) * cellSize}px`;
    element.style.top = `${(tile.y + offsetY) * cellSize}px`;
    element.style.width = `${cellSize}px`;
    element.style.height = `${cellSize}px`;
    element.style.setProperty("--tile-index", index);
    fragment.append(element);
  }

  gridCanvas.replaceChildren(fragment);
  tileCount.textContent = String(shape.tileCount);
  board.setAttribute(
    "aria-label",
    `Grade de ${settings.columns} colunas por ${settings.rows} linhas com formato conectado de ${shape.tileCount} tiles. Clique ou pressione G para gerar outro formato; pressione S para configurações.`,
  );
}

function generateAndRender() {
  currentShape = generateShape({
    minTiles: settings.minTiles,
    maxTiles: settings.maxTiles,
    maxWidth: settings.columns,
    maxHeight: settings.rows,
  });
  renderShape(currentShape);
}

function openSettings() {
  minInput.value = String(settings.minTiles);
  maxInput.value = String(settings.maxTiles);
  rowsInput.value = String(settings.rows);
  columnsInput.value = String(settings.columns);
  for (const input of [minInput, maxInput, rowsInput, columnsInput]) {
    input.setCustomValidity("");
  }
  settingsDialog.showModal();
  minInput.focus();
}

function closeSettings() {
  settingsDialog.close();
  board.focus();
}

function isTextEntry(element) {
  return element instanceof HTMLElement && (
    element.isContentEditable ||
    element.matches("input, textarea, select")
  );
}

board.addEventListener("click", generateAndRender);
openSettingsButton.addEventListener("click", openSettings);
closeSettingsButton.addEventListener("click", closeSettings);
cancelSettingsButton.addEventListener("click", closeSettings);
settingsDialog.addEventListener("close", () => board.focus());

settingsForm.addEventListener("submit", (event) => {
  event.preventDefault();
  for (const input of [minInput, maxInput, rowsInput, columnsInput]) {
    input.setCustomValidity("");
  }

  try {
    settings = validateSettings({
      minTiles: Number(minInput.value),
      maxTiles: Number(maxInput.value),
      rows: Number(rowsInput.value),
      columns: Number(columnsInput.value),
    });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Keep the settings active for this page even when storage is unavailable.
    }
    generateAndRender();
    closeSettings();
  } catch (error) {
    const invalidInput = error.message.startsWith("Rows")
      ? rowsInput
      : error.message.startsWith("Columns")
        ? columnsInput
        : error.message.startsWith("Minimum") && !error.message.includes("greater")
          ? minInput
          : maxInput;
    invalidInput.setCustomValidity(error.message);
    invalidInput.reportValidity();
  }
});

for (const input of [minInput, maxInput, rowsInput, columnsInput]) {
  input.addEventListener("input", () => input.setCustomValidity(""));
}

document.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || isTextEntry(event.target)) return;
  if (settingsDialog.open) return;

  const key = event.key.toLowerCase();
  if (key === "g") {
    event.preventDefault();
    generateAndRender();
  } else if (key === "s") {
    event.preventDefault();
    openSettings();
  }
});

window.addEventListener("resize", () => {
  cancelAnimationFrame(resizeFrame);
  resizeFrame = requestAnimationFrame(() => {
    if (currentShape) renderShape(currentShape);
  });
});

generateAndRender();
