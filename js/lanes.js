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
  // Plain gray here used to read as a generic-error tile rather than a
  // subway track — rail rows now use a dedicated track texture instead
  // (see makeRailTrackTexture / materialFor's 'rail' special case below).
  rail: [0x707070, 0x787878],
  // Plaza paving, not a plain "finish line yellow" tile — the office
  // building + banner (buildFinishLine below) carry the arrival moment now.
  finish: [0xd7ccc8, 0xdfd6d3],
  // Grass shoulder beyond the playable lanes — the camera's view is wider
  // than the lanes themselves, so without this, obstacles wrapping around
  // the edge of the road briefly show up floating over bare sky.
  shoulder: [0x7a9a5a, 0x82a262],
};

// How many extra tiles of shoulder to draw on each side beyond the playable
// lanes. Must cover the gap between the last lane tile and the camera's edge
// (HALF_WIDTH in scene.js) — 2 tiles comfortably does that with room to spare.
const SHOULDER_WIDTH = 2;

// Ballast + two rails + sleepers, tileable along the row so it reads as one
// continuous track rather than a flat gray slab (which read as a rendering
// glitch rather than "subway").
function makeRailTrackTexture() {
  return makeCanvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#5c534a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
    for (let i = 0; i < 30; i += 1) {
      const rx = (i * 37) % w;
      const ry = (i * 53) % h;
      ctx.fillRect(rx, ry, 3, 3);
    }
    // wooden ties, two per tile so the spacing repeats cleanly tile-to-tile
    ctx.fillStyle = '#3e2f22';
    [0.25, 0.75].forEach((cx) => {
      ctx.fillRect(cx * w - w * 0.09, h * 0.12, w * 0.18, h * 0.76);
    });
    // rails: two continuous metal lines spanning the full tile width
    ctx.fillStyle = '#d7dadc';
    ctx.fillRect(0, h * 0.28, w, h * 0.09);
    ctx.fillRect(0, h * 0.63, w, h * 0.09);
    ctx.strokeStyle = '#8a8f93';
    ctx.lineWidth = 2;
    ctx.strokeRect(0, h * 0.28, w, h * 0.09);
    ctx.strokeRect(0, h * 0.63, w, h * 0.09);
  });
}

export function buildLanes(scene, rows) {
  const geometry = new THREE.BoxGeometry(TILE_SIZE * 0.95, 0.15, TILE_SIZE * 0.95);
  const materialCache = new Map();
  let railTexture = null;

  function materialFor(type, parity) {
    const cacheKey = `${type}:${parity}`;
    if (!materialCache.has(cacheKey)) {
      if (type === 'rail') {
        if (!railTexture) railTexture = makeRailTrackTexture();
        materialCache.set(cacheKey, new THREE.MeshLambertMaterial({ map: railTexture }));
      } else {
        const palette = PALETTES[type] || PALETTES.safe;
        materialCache.set(cacheKey, new THREE.MeshLambertMaterial({ color: palette[parity] }));
      }
    }
    return materialCache.get(cacheKey);
  }

  function addRow(z, type) {
    const parity = ((z % 2) + 2) % 2;
    const material = materialFor(type, parity);
    const shoulderMaterial = materialFor('shoulder', parity);
    for (let x = LANE_MIN_X - SHOULDER_WIDTH; x <= LANE_MAX_X + SHOULDER_WIDTH; x++) {
      const isShoulder = x < LANE_MIN_X || x > LANE_MAX_X;
      const tile = new THREE.Mesh(geometry, isShoulder ? shoulderMaterial : material);
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

function buildPillar() {
  const group = new THREE.Group();

  const pillar = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 2.4, 0.32),
    new THREE.MeshLambertMaterial({ color: 0x546069 })
  );
  pillar.position.y = 1.2;
  group.add(pillar);

  const light = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.16, 0.4),
    new THREE.MeshBasicMaterial({ color: 0xffe082 })
  );
  light.position.y = 2.45;
  group.add(light);

  return group;
}

// Plants a support pillar (with a little platform light on top) at both lane
// edges of every row in the subway stage, so it reads as an underground
// platform/tunnel rather than just an odd gray strip with a train on it.
export function buildSubwayProps(scene, rows) {
  rows
    .filter((row) => row.stageKey === 'subway')
    .forEach((row) => {
      [LANE_MIN_X - 0.65, LANE_MAX_X + 0.65].forEach((x) => {
        const pillar = buildPillar();
        pillar.position.set(x * TILE_SIZE, 0, row.z * TILE_SIZE);
        scene.add(pillar);
      });
    });
}
