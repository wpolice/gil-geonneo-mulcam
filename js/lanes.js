import * as THREE from 'three';
import { TILE_SIZE, LANE_MIN_X, LANE_MAX_X } from './constants.js';

// A few rows render behind row 0 purely as a visual backdrop (the player can
// never step there) so the very start of the route isn't half empty sky.
const BACKDROP_ROWS = 4;

const PALETTES = {
  safe: [0x8bc34a, 0x9ccc65],
  bike: [0xb0bec5, 0xbcc7cc],
  road: [0x424242, 0x4a4a4a],
  bus: [0x6d4c41, 0x745246],
  rail: [0x707070, 0x787878],
  // Plaza paving, not a plain "finish line yellow" tile — the office
  // building + banner (buildFinishLine below) carry the arrival moment now.
  finish: [0xd7ccc8, 0xdfd6d3],
};

export function buildLanes(scene, rows) {
  const geometry = new THREE.BoxGeometry(TILE_SIZE * 0.95, 0.15, TILE_SIZE * 0.95);
  const materialCache = new Map();

  function materialFor(type, parity) {
    const cacheKey = `${type}:${parity}`;
    if (!materialCache.has(cacheKey)) {
      const palette = PALETTES[type] || PALETTES.safe;
      materialCache.set(cacheKey, new THREE.MeshLambertMaterial({ color: palette[parity] }));
    }
    return materialCache.get(cacheKey);
  }

  function addRow(z, type) {
    const parity = ((z % 2) + 2) % 2;
    const material = materialFor(type, parity);
    for (let x = LANE_MIN_X; x <= LANE_MAX_X; x++) {
      const tile = new THREE.Mesh(geometry, material);
      tile.position.set(x * TILE_SIZE, -0.075, z * TILE_SIZE);
      scene.add(tile);
    }
  }

  for (let z = -BACKDROP_ROWS; z < 0; z++) addRow(z, 'safe');
  for (const row of rows) addRow(row.z, row.type);
}

function makeCanvasTexture(width, height, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

function makeCharTexture(char) {
  return makeCanvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#FF6F05';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 176px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(char, w / 2, h / 2 + 12);
  });
}

function makeCheckerTexture() {
  const texture = makeCanvasTexture(64, 64, (ctx, w, h) => {
    const cells = 8;
    const cell = w / cells;
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#ffffff' : '#212121';
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
  });
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 1);
  return texture;
}

// One character per lane — "멀티캠퍼스출근" is exactly 7 characters, matching
// the 7 lanes (LANE_MIN_X..LANE_MAX_X).
const FINISH_TEXT = '멀티캠퍼스출근';

function buildFinishDisplay() {
  const group = new THREE.Group();
  const chars = FINISH_TEXT.split('');

  // Checkered finish-line stripe painted on the ground, so the row itself
  // reads as a finish line rather than just a spot where signs happen to stand.
  const stripe = new THREE.Mesh(
    new THREE.PlaneGeometry((LANE_MAX_X - LANE_MIN_X) * TILE_SIZE + TILE_SIZE, TILE_SIZE * 0.9),
    new THREE.MeshBasicMaterial({ map: makeCheckerTexture() })
  );
  stripe.rotation.x = -Math.PI / 2;
  stripe.position.set((LANE_MIN_X + LANE_MAX_X) * 0.5 * TILE_SIZE, 0.02, 0);
  group.add(stripe);

  // One standing sign per lane, upright and facing back toward the player.
  chars.forEach((char, i) => {
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(TILE_SIZE * 0.7, TILE_SIZE * 0.9),
      new THREE.MeshBasicMaterial({ map: makeCharTexture(char) })
    );
    sign.rotation.y = Math.PI;
    sign.position.set((LANE_MAX_X - i) * TILE_SIZE, 0.55, 0);
    group.add(sign);
  });

  return group;
}

// Dresses the finish row with a checkered finish-line stripe plus one
// standing sign per lane spelling "멀티캠퍼스출근", facing the player.
export function buildFinishLine(scene, rows) {
  const finishRow = rows.find((row) => row.type === 'finish');
  if (!finishRow) return;

  const display = buildFinishDisplay();
  display.position.z = finishRow.z * TILE_SIZE;
  scene.add(display);
}
