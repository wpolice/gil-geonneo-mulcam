import * as THREE from 'three';

const CAMERA_OFFSET = new THREE.Vector3(0, 9, -9);
// Look slightly ahead of the player instead of exactly at them, so the
// character sits in the lower part of the screen and more of the road
// ahead is visible (otherwise there's nothing behind row 0 at game start,
// wasting the bottom half of the screen on empty sky).
const LOOK_AHEAD_Z = 2;
// Half-width is fixed in world units so the lane always fills roughly the
// same fraction of screen width; half-height derives from aspect so scale
// stays uniform (no stretching) while taller windows simply reveal more rows.
const HALF_WIDTH = 4.2;

export function createScene(canvas) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x8fd3ff);

  const aspect = window.innerWidth / window.innerHeight;
  const camera = new THREE.OrthographicCamera(
    -HALF_WIDTH, HALF_WIDTH,
    HALF_WIDTH / aspect, -HALF_WIDTH / aspect,
    0.1, 100
  );

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));

  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(8, 12, -6);
  scene.add(sun);

  // Camera only tracks forward progress (Z). X and Y stay fixed so the lane
  // itself never shifts sideways or bobs — only the character visibly moves
  // left/right/up/down on screen.
  function updateCamera(targetPos) {
    const focusZ = targetPos.z + LOOK_AHEAD_Z;
    camera.position.set(
      CAMERA_OFFSET.x,
      CAMERA_OFFSET.y,
      focusZ + CAMERA_OFFSET.z
    );
    camera.lookAt(0, 0, focusZ);
  }

  function onResize() {
    const aspect = window.innerWidth / window.innerHeight;
    camera.left = -HALF_WIDTH;
    camera.right = HALF_WIDTH;
    camera.top = HALF_WIDTH / aspect;
    camera.bottom = -HALF_WIDTH / aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  return { scene, camera, renderer, updateCamera };
}
