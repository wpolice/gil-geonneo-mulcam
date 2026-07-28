// All sound (BGM + SFX) is synthesized live via the Web Audio API — no
// external audio files, so there's nothing to license or download.
let audioCtx = null;
let musicGain = null;
let sfxGain = null;

function ensureContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    musicGain = audioCtx.createGain();
    musicGain.gain.value = 0.16;
    musicGain.connect(audioCtx.destination);
    sfxGain = audioCtx.createGain();
    sfxGain.gain.value = 0.35;
    sfxGain.connect(audioCtx.destination);
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

// Call this from a real click/keydown handler — browsers block audio until
// the page has seen a genuine user gesture.
export function unlockAudio() {
  ensureContext();
}

function tone({ freq, duration = 0.12, type = 'sine', gain = 0.4, when = 0, release = 0.08 }) {
  const ctx = ensureContext();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  const t0 = ctx.currentTime + when;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.005);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration + release);
  osc.connect(g);
  g.connect(sfxGain);
  osc.start(t0);
  osc.stop(t0 + duration + release + 0.02);
}

export function playHop() {
  tone({ freq: 520, duration: 0.045, type: 'square', gain: 0.18 });
}

export function playPickup() {
  [660, 880, 1320].forEach((freq, i) => tone({ freq, duration: 0.08, type: 'sine', gain: 0.3, when: i * 0.05 }));
}

export function playShieldSave() {
  tone({ freq: 200, duration: 0.05, type: 'square', gain: 0.3 });
  tone({ freq: 900, duration: 0.12, type: 'triangle', gain: 0.3, when: 0.04 });
}

export function playCollision() {
  const ctx = ensureContext();
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sawtooth';
  const t0 = ctx.currentTime;
  osc.frequency.setValueAtTime(180, t0);
  osc.frequency.exponentialRampToValueAtTime(45, t0 + 0.35);
  g.gain.setValueAtTime(0.35, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
  osc.connect(g);
  g.connect(sfxGain);
  osc.start(t0);
  osc.stop(t0 + 0.42);
}

const ARRIVAL_CHORDS = {
  perfect: [523.25, 659.25, 783.99], // C5 major triad, bright
  onTime: [440, 554.37, 659.25], // A4 major triad
  late: [349.23, 329.63, 293.66], // descending "womp"
};

export function playArrival(gradeKey) {
  const notes = ARRIVAL_CHORDS[gradeKey] || ARRIVAL_CHORDS.late;
  notes.forEach((freq, i) => tone({ freq, duration: 0.22, type: 'triangle', gain: 0.32, when: i * 0.13 }));
}

// --- Background music: a short looping arpeggio, scheduled ahead of time
// against the AudioContext clock so timing stays accurate regardless of
// setInterval jitter. ---
const BGM_MELODY = [261.63, 329.63, 392.0, 329.63, 293.66, 349.23, 392.0, 440.0];
const BGM_BASS = [130.81, 0, 0, 0, 146.83, 0, 0, 0];
const STEP_DURATION = 0.28;
const SCHEDULE_AHEAD = 0.2;

let musicPlaying = false;
let musicStep = 0;
let nextStepTime = 0;
let musicTimerId = null;

function scheduleNote(freq, time, type, gain, duration) {
  if (!freq) return;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0, time);
  g.gain.linearRampToValueAtTime(gain, time + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  osc.connect(g);
  g.connect(musicGain);
  osc.start(time);
  osc.stop(time + duration + 0.02);
}

function musicScheduler() {
  while (nextStepTime < audioCtx.currentTime + SCHEDULE_AHEAD) {
    const i = musicStep % BGM_MELODY.length;
    scheduleNote(BGM_MELODY[i], nextStepTime, 'triangle', 0.2, STEP_DURATION * 0.85);
    scheduleNote(BGM_BASS[i], nextStepTime, 'sine', 0.25, STEP_DURATION * 1.6);
    nextStepTime += STEP_DURATION;
    musicStep += 1;
  }
}

export function startMusic() {
  ensureContext();
  if (musicPlaying) return;
  musicPlaying = true;
  musicStep = 0;
  nextStepTime = audioCtx.currentTime + 0.1;
  musicScheduler();
  musicTimerId = setInterval(musicScheduler, 100);
}

export function stopMusic() {
  musicPlaying = false;
  if (musicTimerId) clearInterval(musicTimerId);
  musicTimerId = null;
}
