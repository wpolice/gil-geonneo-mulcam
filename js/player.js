import * as THREE from 'three';
import { TILE_SIZE, LANE_MIN_X, LANE_MAX_X } from './constants.js';
import { TOTAL_ROWS } from './stages.js';

const HOP_DURATION = 0.1;

function buildCharacterMesh() {
  const group = new THREE.Group();

  const skin = new THREE.MeshLambertMaterial({ color: 0xffd9b3 });
  const shirt = new THREE.MeshLambertMaterial({ color: 0x3b82f6 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x1f2937 });
  const bagMat = new THREE.MeshLambertMaterial({ color: 0x7c3f00 });

  const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), skin);
  head.position.y = 0.9;
  group.add(head);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.5, 0.28), shirt);
  torso.position.y = 0.55;
  group.add(torso);

  const legGeo = new THREE.BoxGeometry(0.16, 0.35, 0.16);
  const legL = new THREE.Mesh(legGeo, pants);
  legL.position.set(-0.12, 0.18, 0);
  group.add(legL);
  const legR = new THREE.Mesh(legGeo, pants);
  legR.position.set(0.12, 0.18, 0);
  group.add(legR);

  const armGeo = new THREE.BoxGeometry(0.14, 0.35, 0.14);
  const armL = new THREE.Mesh(armGeo, shirt);
  armL.position.set(-0.3, 0.55, 0);
  group.add(armL);
  const armR = new THREE.Mesh(armGeo, shirt);
  armR.position.set(0.3, 0.55, 0);
  group.add(armR);

  const bag = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.15), bagMat);
  bag.position.set(0, 0.55, -0.2);
  group.add(bag);

  group.userData.legs = [legL, legR];
  return group;
}

export function createPlayer(scene) {
  const mesh = buildCharacterMesh();
  scene.add(mesh);

  const state = {
    gridX: 0,
    gridZ: 0,
    fromX: 0,
    fromZ: 0,
    toX: 0,
    toZ: 0,
    t: 1,
    invincible: false,
    barrier: false,
    // True for exactly one update() call right after a hop starts (whether
    // triggered immediately or from the buffered queue) — main.js reads
    // this once per frame to know when to play the hop sound, then clears it.
    justHopped: false,
  };
  let invincibleBlinkTimer = 0;
  // A key pressed just before the current hop finishes is buffered here and
  // fired the instant the tween completes, instead of being dropped — this
  // is what makes rapid direction taps feel responsive.
  let queuedHop = null;

  function isMoving() {
    return state.t < 1;
  }

  function performHop(dx, dz) {
    const nextX = state.gridX + dx;
    const nextZ = state.gridZ + dz;
    if (nextX < LANE_MIN_X || nextX > LANE_MAX_X) return false;
    if (nextZ < 0 || nextZ > TOTAL_ROWS - 1) return false;

    state.fromX = state.gridX;
    state.fromZ = state.gridZ;
    state.toX = nextX;
    state.toZ = nextZ;
    state.gridX = nextX;
    state.gridZ = nextZ;
    state.t = 0;
    state.justHopped = true;
    return true;
  }

  function hop(dx, dz) {
    if (isMoving()) {
      queuedHop = [dx, dz];
      return false;
    }
    return performHop(dx, dz);
  }

  function update(dt) {
    if (state.invincible) {
      invincibleBlinkTimer += dt;
      mesh.visible = Math.floor(invincibleBlinkTimer * 10) % 2 === 0;
    } else {
      invincibleBlinkTimer = 0;
      mesh.visible = true;
    }

    if (state.t >= 1) {
      if (queuedHop) {
        const [dx, dz] = queuedHop;
        queuedHop = null;
        performHop(dx, dz);
      }
      return;
    }

    state.t = Math.min(1, state.t + dt / HOP_DURATION);
    const ease = 1 - Math.pow(1 - state.t, 2);
    const x = THREE.MathUtils.lerp(state.fromX, state.toX, ease);
    const z = THREE.MathUtils.lerp(state.fromZ, state.toZ, ease);
    const bounce = Math.sin(state.t * Math.PI) * 0.35;
    mesh.position.set(x * TILE_SIZE, bounce, z * TILE_SIZE);

    const legSwing = Math.sin(state.t * Math.PI) * 0.6;
    mesh.userData.legs[0].rotation.x = legSwing;
    mesh.userData.legs[1].rotation.x = -legSwing;
  }

  function getWorldPosition() {
    return mesh.position;
  }

  // Snaps the player straight back to the start tile, no tween — used for the
  // temporary collision/arrival response until the real game-over/success UI exists.
  function reset() {
    state.gridX = 0;
    state.gridZ = 0;
    state.fromX = 0;
    state.fromZ = 0;
    state.toX = 0;
    state.toZ = 0;
    state.t = 1;
    state.invincible = false;
    state.barrier = false;
    state.justHopped = false;
    queuedHop = null;
    mesh.position.set(0, 0, 0);
    mesh.visible = true;
    mesh.userData.legs[0].rotation.x = 0;
    mesh.userData.legs[1].rotation.x = 0;
  }

  // Teleports the player to an arbitrary tile, idle (no tween) — used by the
  // Copilot power-up to warp ahead to the next safe row.
  function relocate(gridX, gridZ) {
    state.gridX = gridX;
    state.gridZ = gridZ;
    state.fromX = gridX;
    state.fromZ = gridZ;
    state.toX = gridX;
    state.toZ = gridZ;
    state.t = 1;
    queuedHop = null;
    mesh.position.set(gridX * TILE_SIZE, 0, gridZ * TILE_SIZE);
  }

  return { hop, update, getWorldPosition, isMoving, reset, relocate, state };
}
