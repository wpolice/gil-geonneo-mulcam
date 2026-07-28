import * as THREE from 'three';
import { TILE_SIZE, LANE_MIN_X, LANE_MAX_X } from './constants.js';

// Real logo images live under assets/logos/ — drop a transparent-background
// PNG (square, ~256x256 is plenty) at each path below. Each logo also carries
// a power-up effect (applied on pickup alongside the usual score/count),
// themed to what each AI is actually known for:
//   ChatGPT  - 1.5초 무적: 만능 올라운더
//   Claude   - 충돌 1회 무효화: AI Safety가 핵심 미션
//   Gemini   - 출근 시계 되돌리기: 긴 컨텍스트(기억력)가 특징
//   Copilot  - 다음 안전 구간(초록길)으로 즉시 이동: 자동완성 페어 프로그래머
export const LOGOS = [
  { key: 'chatgpt', label: 'ChatGPT', file: 'assets/logos/chatgpt.png', effect: 'invincible', duration: 1.5 },
  { key: 'claude', label: 'Claude', file: 'assets/logos/claude.png', effect: 'barrier' },
  { key: 'gemini', label: 'Gemini', file: 'assets/logos/gemini.png', effect: 'rewind', minutes: 3 },
  { key: 'copilot', label: 'Copilot', file: 'assets/logos/copilot.png', effect: 'autoDodge' },
];

const BOB_SPEED = 2.5;
const BOB_HEIGHT = 0.12;
const SPIN_SPEED = 1.6;
const BASE_HEIGHT = 0.5;
const PICKUP_RADIUS = 0.5;

const textureLoader = new THREE.TextureLoader();

function loadLogoTexture(file) {
  return textureLoader.load(file, undefined, undefined, () => {
    console.warn(`로고 이미지를 찾을 수 없어요: ${file} — assets/logos/ 폴더에 파일을 추가해주세요.`);
  });
}

function buildCoinMesh(texture) {
  const group = new THREE.Group();

  // Solid white puck behind the logo, so transparent PNG regions show white
  // instead of whatever road/grass is underneath.
  const whiteMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.32, 0.06, 24),
    [whiteMaterial, whiteMaterial, whiteMaterial]
  );
  group.add(body);

  const logoPlane = new THREE.Mesh(
    new THREE.CircleGeometry(0.28, 24),
    new THREE.MeshBasicMaterial({ map: texture, transparent: true })
  );
  logoPlane.rotation.x = -Math.PI / 2;
  logoPlane.position.y = 0.031;
  group.add(logoPlane);

  return group;
}

function pickDistinctRows(rows, count) {
  const eligible = rows.filter((row) => row.type !== 'finish');
  const shuffled = [...eligible].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function createCollectibles(scene, rows) {
  const items = [];

  // Spawns exactly one of each logo, on distinct rows — called once up front
  // and again by reset() so every round starts with the full set again.
  function spawnAll() {
    const spawnRows = pickDistinctRows(rows, LOGOS.length);
    LOGOS.forEach((def, i) => {
      const row = spawnRows[i];
      if (!row) return;

      const lane = LANE_MIN_X + Math.floor(Math.random() * (LANE_MAX_X - LANE_MIN_X + 1));
      const mesh = buildCoinMesh(loadLogoTexture(def.file));
      mesh.position.set(lane * TILE_SIZE, BASE_HEIGHT, row.z * TILE_SIZE);
      scene.add(mesh);

      items.push({ mesh, def, collected: false, bobOffset: Math.random() * Math.PI * 2 });
    });
  }

  spawnAll();

  function reset() {
    items.forEach((item) => scene.remove(item.mesh));
    items.length = 0;
    spawnAll();
  }

  let elapsed = 0;

  function update(dt) {
    elapsed += dt;
    items.forEach((item) => {
      if (item.collected) return;
      item.mesh.position.y = BASE_HEIGHT + Math.sin(elapsed * BOB_SPEED + item.bobOffset) * BOB_HEIGHT;
      item.mesh.rotation.y += SPIN_SPEED * dt;
    });
  }

  // Returns the picked-up item's def (or null) and removes its mesh from the scene.
  function checkPickup(playerPos) {
    for (const item of items) {
      if (item.collected) continue;
      const dx = item.mesh.position.x - playerPos.x;
      const dz = item.mesh.position.z - playerPos.z;
      if (Math.hypot(dx, dz) < PICKUP_RADIUS) {
        item.collected = true;
        scene.remove(item.mesh);
        return item.def;
      }
    }
    return null;
  }

  return { update, checkPickup, reset };
}
