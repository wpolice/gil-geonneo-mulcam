import * as THREE from 'three';
import { TILE_SIZE, LANE_MIN_X, LANE_MAX_X } from './constants.js';

const LANE_SPAN = LANE_MAX_X - LANE_MIN_X + 1;
const WRAP_MARGIN = 1.5;
const LEFT_EDGE = LANE_MIN_X * TILE_SIZE - WRAP_MARGIN;
const RIGHT_EDGE = LANE_MAX_X * TILE_SIZE + WRAP_MARGIN;
const WRAP_SPAN = RIGHT_EDGE - LEFT_EDGE;

function buildCar(color) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.8, 0.35, 0.6),
    new THREE.MeshLambertMaterial({ color })
  );
  body.position.y = 0.28;
  group.add(body);

  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.24, 0.5),
    new THREE.MeshLambertMaterial({ color: 0xbfe6ff })
  );
  cabin.position.y = 0.55;
  group.add(cabin);

  const wheelGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  [
    [-0.28, -0.26], [0.28, -0.26],
    [-0.28, 0.26], [0.28, 0.26],
  ].forEach(([dx, dz]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(dx, 0.09, dz);
    group.add(wheel);
  });

  return group;
}

function buildBus(color) {
  const group = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 0.65, 0.7),
    new THREE.MeshLambertMaterial({ color })
  );
  body.position.y = 0.42;
  group.add(body);

  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(1.62, 0.14, 0.72),
    new THREE.MeshLambertMaterial({ color: 0xffffff })
  );
  stripe.position.y = 0.5;
  group.add(stripe);

  const wheelGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  [
    [-0.55, -0.35], [0.55, -0.35],
    [-0.55, 0.35], [0.55, 0.35],
  ].forEach(([dx, dz]) => {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.position.set(dx, 0.11, dz);
    group.add(wheel);
  });

  return group;
}

function buildTrain() {
  const group = new THREE.Group();
  const width = LANE_SPAN * TILE_SIZE + 1.2;

  const body = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.9, 0.85),
    new THREE.MeshLambertMaterial({ color: 0x37474f })
  );
  body.position.y = 0.5;
  group.add(body);

  const stripe = new THREE.Mesh(
    new THREE.BoxGeometry(width, 0.16, 0.87),
    new THREE.MeshLambertMaterial({ color: 0xffca28 })
  );
  stripe.position.y = 0.68;
  group.add(stripe);

  return group;
}

function buildWarningStrip() {
  return new THREE.Mesh(
    new THREE.BoxGeometry(LANE_SPAN * TILE_SIZE, 0.05, 0.9),
    new THREE.MeshBasicMaterial({ color: 0xff5252, transparent: true, opacity: 0.6 })
  );
}

const CAR_COLORS = [0xe53935, 0x3949ab, 0xfb8c00, 0x00897b, 0x8e24aa];

export function createObstacles(scene, rows) {
  const movers = [];
  const railStates = [];

  let carColorIndex = 0;

  rows.forEach((row) => {
    if (row.type === 'bike' || row.type === 'road') {
      const count = row.count || (row.type === 'bike' ? 1 : 2);
      for (let i = 0; i < count; i++) {
        const color = row.type === 'bike' ? 0xffd54f : CAR_COLORS[carColorIndex++ % CAR_COLORS.length];
        const mesh = buildCar(color);
        scene.add(mesh);
        const startX = LEFT_EDGE + (WRAP_SPAN / count) * i;
        mesh.position.set(startX, 0, row.z * TILE_SIZE);
        movers.push({
          mesh,
          rowZ: row.z,
          dir: row.dir || 1,
          speed: row.speed || 1.5,
          halfWidth: row.type === 'bike' ? 0.3 : 0.4,
        });
      }
    } else if (row.type === 'bus') {
      const count = row.count || 1;
      for (let i = 0; i < count; i++) {
        const mesh = buildBus(0xffb300);
        scene.add(mesh);
        const startX = LEFT_EDGE + (WRAP_SPAN / count) * i;
        mesh.position.set(startX, 0, row.z * TILE_SIZE);
        movers.push({
          mesh,
          rowZ: row.z,
          dir: row.dir || 1,
          speed: row.speed || 1.2,
          halfWidth: 0.8,
        });
      }
    } else if (row.type === 'rail') {
      const trainMesh = buildTrain();
      const warnMesh = buildWarningStrip();
      trainMesh.visible = false;
      warnMesh.visible = false;
      trainMesh.position.set(0, 0, row.z * TILE_SIZE);
      warnMesh.position.set(0, 0.05, row.z * TILE_SIZE);
      scene.add(trainMesh);
      scene.add(warnMesh);
      railStates.push({
        rowZ: row.z,
        phase: 'safe',
        timer: (row.period || 3.5) * (0.3 + 0.4 * Math.random()),
        period: row.period || 3.5,
        warning: row.warning || 1,
        sweep: row.sweep || 0.6,
        trainMesh,
        warnMesh,
      });
    }
  });

  function update(dt) {
    movers.forEach((m) => {
      m.mesh.position.x += m.dir * m.speed * dt;
      if (m.dir > 0 && m.mesh.position.x > RIGHT_EDGE) m.mesh.position.x -= WRAP_SPAN;
      if (m.dir < 0 && m.mesh.position.x < LEFT_EDGE) m.mesh.position.x += WRAP_SPAN;
    });

    railStates.forEach((state) => {
      state.timer -= dt;
      if (state.phase === 'safe' && state.timer <= 0) {
        state.phase = 'warning';
        state.timer = state.warning;
        state.warnMesh.visible = true;
      } else if (state.phase === 'warning' && state.timer <= 0) {
        state.phase = 'sweep';
        state.timer = state.sweep;
        state.warnMesh.visible = false;
        state.trainMesh.visible = true;
      } else if (state.phase === 'sweep' && state.timer <= 0) {
        state.phase = 'safe';
        state.timer = state.period;
        state.trainMesh.visible = false;
      }
    });
  }

  // playerPos is the player's smoothed world position (mid-hop included);
  // collision is checked against whichever row that position currently rounds to.
  function checkCollision(playerPos) {
    const playerRowZ = Math.round(playerPos.z / TILE_SIZE);

    for (const m of movers) {
      if (m.rowZ !== playerRowZ) continue;
      const dx = Math.abs(m.mesh.position.x - playerPos.x);
      if (dx < m.halfWidth + 0.32) return true;
    }

    for (const state of railStates) {
      if (state.phase === 'sweep' && state.rowZ === playerRowZ) return true;
    }

    return false;
  }

  return { update, checkCollision };
}
