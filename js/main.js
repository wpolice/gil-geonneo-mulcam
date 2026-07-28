import { createScene } from './scene.js';
import { createPlayer } from './player.js';
import { initInput } from './input.js';
import { buildLanes, buildFinishLine } from './lanes.js';
import { createObstacles } from './obstacles.js';
import { createCollectibles, LOGOS } from './collectibles.js';
import { createClock } from './clock.js';
import { ROWS, TOTAL_ROWS, stageNameAt } from './stages.js';
import { unlockAudio, playHop, playPickup, playShieldSave, playCollision, playArrival, startMusic, stopMusic } from './audio.js';

const canvas = document.getElementById('game-canvas');
const { scene, camera, renderer, updateCamera } = createScene(canvas);

buildLanes(scene, ROWS);
buildFinishLine(scene, ROWS);

const player = createPlayer(scene);
const obstacles = createObstacles(scene, ROWS);
const collectibles = createCollectibles(scene, ROWS);
const clock = createClock();

initInput((dx, dz) => {
  if (gameState !== 'playing') return;
  if (player.hop(dx, dz)) playHop();
});

// --- HUD: top-right row of logo slots, lit up as each is collected ---
const hudEl = document.getElementById('hud-collectibles');
const hudSlots = new Map();
LOGOS.forEach((def) => {
  const slot = document.createElement('div');
  slot.className = 'slot';
  const img = document.createElement('img');
  img.src = def.file;
  img.alt = def.label;
  slot.appendChild(img);
  hudEl.appendChild(slot);
  hudSlots.set(def.key, slot);
});

function setHudCollected(key, collectedNow) {
  const slot = hudSlots.get(key);
  if (slot) slot.classList.toggle('collected', collectedNow);
}

function resetHud() {
  hudSlots.forEach((slot) => slot.classList.remove('collected'));
}

// --- HUD: live commute clock, top-left ---
const clockEl = document.getElementById('hud-clock');

// --- Screens: home (title), help (controls), result (arrival/collision outcome) ---
const screenHomeEl = document.getElementById('screen-home');
const screenHelpEl = document.getElementById('screen-help');
const screenResultEl = document.getElementById('screen-result');
const resultTitleEl = document.getElementById('result-title');
const resultTimeEl = document.getElementById('result-time');
const resultLogosEl = document.getElementById('result-logos');
const resultScoreEl = document.getElementById('result-score');

let gameState = 'home'; // 'home' | 'playing' | 'result'

function showResult({ title, time, logos, score: scoreText }) {
  resultTitleEl.textContent = title;
  resultTimeEl.textContent = time;
  resultLogosEl.textContent = logos;
  resultScoreEl.textContent = scoreText;
  screenResultEl.classList.remove('hidden');
  gameState = 'result';
  stopMusic();
}

// Resets all round state and starts (or restarts) a fresh commute.
function startRound() {
  unlockAudio();
  player.reset();
  collectibles.reset();
  score = 0;
  logoCount = 0;
  shieldTimer = 0;
  barrierGraceActive = false;
  clock.reset();
  resetHud();
  screenHomeEl.classList.add('hidden');
  screenResultEl.classList.add('hidden');
  gameState = 'playing';
  startMusic();
}

function goHome() {
  screenResultEl.classList.add('hidden');
  screenHomeEl.classList.remove('hidden');
  gameState = 'home';
}

document.getElementById('btn-start').addEventListener('click', startRound);
document.getElementById('btn-retry').addEventListener('click', startRound);
document.getElementById('btn-home').addEventListener('click', goHome);

// Help overlays on top of the home screen without changing gameState —
// closing it just returns to the same home screen underneath.
document.getElementById('btn-help').addEventListener('click', () => {
  unlockAudio();
  screenHelpEl.classList.remove('hidden');
});
document.getElementById('btn-help-close').addEventListener('click', () => {
  screenHelpEl.classList.add('hidden');
});

let lastStageName = '';
let score = 0;
let logoCount = 0;
let shieldTimer = 0;
// Claude's barrier grants invincibility that lasts exactly as long as the
// hazard that triggered it is still overlapping — a fixed timer isn't long
// enough for slower buses or a full rail sweep, so this clears dynamically
// once obstacles.checkCollision goes false again.
let barrierGraceActive = false;

// Copilot's effect: warp straight to the next upcoming safe (초록) row ahead,
// skipping over whatever hazard comes next.
function findNextSafeRowZ(afterZ) {
  for (const row of ROWS) {
    if (row.z > afterZ && row.type === 'safe') return row.z;
  }
  return null;
}

function applyPickup(def) {
  logoCount += 1;
  score += 50;
  console.log(`${def.label} 로고 획득! (${logoCount}개, 점수 ${score})`);
  setHudCollected(def.key, true);
  playPickup();

  if (def.effect === 'invincible') {
    shieldTimer = def.duration;
    console.log(`🛡️ 무적 발동! ${def.duration}초간 충돌 무시`);
  } else if (def.effect === 'barrier') {
    player.state.barrier = true;
    console.log('🛡️ 세이프티 배리어 충전! 다음 충돌 1회 무효화');
  } else if (def.effect === 'rewind') {
    clock.rewind(def.minutes);
    console.log(`⏪ 출근 시계 되돌리기! ${def.minutes}분 되돌림 (현재 ${clock.getTimeString()})`);
  } else if (def.effect === 'autoDodge') {
    const targetZ = findNextSafeRowZ(player.state.gridZ);
    if (targetZ !== null) {
      player.relocate(player.state.gridX, targetZ);
      console.log(`🧭 Copilot 발동! 다음 안전 구간으로 이동`);
    } else {
      console.log('🧭 Copilot 발동! (남은 안전 구간이 없어요)');
    }
  }
}

function handleCollision() {
  if (player.state.invincible) return;

  if (player.state.barrier) {
    player.state.barrier = false;
    barrierGraceActive = true;
    console.log('🛡️ Claude 세이프티 배리어 발동! 충돌 무효화');
    playShieldSave();
    return;
  }

  playCollision();
  showResult({
    title: '출근 실패 😢',
    time: clock.getTimeString(),
    logos: `${logoCount}개`,
    score: `${score}`,
  });
}

function handleArrival() {
  const grade = clock.getGrade();
  const finalScore = score + grade.bonus;
  playArrival(grade.key);
  showResult({
    title: `${grade.emoji} ${grade.label}!`,
    time: clock.getTimeString(),
    logos: `${logoCount}개`,
    score: `${score} + 보너스 ${grade.bonus} = ${finalScore}`,
  });
}

let lastTime = performance.now();

function tick(now) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;

  if (gameState === 'playing') {
    player.update(dt);
    obstacles.update(dt);
    collectibles.update(dt);
    clock.update(dt);

    const playerPos = player.getWorldPosition();
    const colliding = obstacles.checkCollision(playerPos);

    if (shieldTimer > 0) {
      shieldTimer -= dt;
      if (shieldTimer <= 0) shieldTimer = 0;
    }
    if (barrierGraceActive && !colliding) {
      barrierGraceActive = false;
    }
    player.state.invincible = shieldTimer > 0 || barrierGraceActive;

    const picked = collectibles.checkPickup(playerPos);
    if (picked) applyPickup(picked);

    if (colliding) {
      handleCollision();
    } else if (!player.isMoving() && player.state.gridZ === TOTAL_ROWS - 1) {
      handleArrival();
    }

    const stageName = stageNameAt(player.state.gridZ);
    if (stageName !== lastStageName) {
      lastStageName = stageName;
      console.log('현재 구간:', stageName);
    }

    clockEl.textContent = `🕐 ${clock.getTimeString()}`;
  }

  updateCamera(player.getWorldPosition());
  renderer.render(scene, camera);

  requestAnimationFrame(tick);
}

requestAnimationFrame(tick);
