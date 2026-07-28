// Commute clock: starts at 08:30 and ticks forward in real time (1 real
// second = 1 in-game minute), independent of how many tiles the player has
// hopped. Grades the arrival time once the player reaches the office.
const START_HOUR = 8;
const START_MINUTE = 30;
const MINUTES_PER_SECOND = 1;

const ON_TIME_DEADLINE = 9 * 60; // 09:00
const LATE_DEADLINE = 9 * 60 + 5; // 09:05

const GRADES = {
  perfect: { key: 'perfect', label: '정시출근', emoji: '🎉', bonus: 500 },
  onTime: { key: 'onTime', label: '턱걸이출근', emoji: '🙂', bonus: 200 },
  late: { key: 'late', label: '지각', emoji: '💦', bonus: 0 },
};

export function createClock() {
  let elapsedMinutes = 0;

  function update(dt) {
    elapsedMinutes += dt * MINUTES_PER_SECOND;
  }

  function rewind(minutes) {
    elapsedMinutes = Math.max(0, elapsedMinutes - minutes);
  }

  function reset() {
    elapsedMinutes = 0;
  }

  function getTotalMinutes() {
    return START_HOUR * 60 + START_MINUTE + elapsedMinutes;
  }

  function getTimeString() {
    const totalMinutes = Math.floor(getTotalMinutes());
    const h = Math.floor(totalMinutes / 60) % 24;
    const m = totalMinutes % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  // Arrival grade based on the current clock: 정시출근 (<=09:00), 턱걸이출근
  // (<=09:05), otherwise 지각.
  function getGrade() {
    const totalMinutes = getTotalMinutes();
    if (totalMinutes <= ON_TIME_DEADLINE) return GRADES.perfect;
    if (totalMinutes <= LATE_DEADLINE) return GRADES.onTime;
    return GRADES.late;
  }

  return { update, rewind, reset, getTimeString, getGrade };
}
