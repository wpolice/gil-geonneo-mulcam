// Defines the 5-stage commute route: home -> crosswalk -> bus stop -> subway
// platform -> office plaza. Each stage is a short sequence of rows; rows are
// flattened into one continuous list so lanes.js/obstacles.js can just treat
// the whole route as a single strip of rows indexed by z.
export const STAGE_DEFS = [
  {
    key: 'home',
    name: '우리집',
    rows: [
      { type: 'safe' },
      { type: 'safe' },
      { type: 'bike', speed: 1.4, dir: 1 },
      { type: 'safe' },
      { type: 'safe' },
    ],
  },
  {
    key: 'crosswalk',
    name: '큰길 횡단보도',
    rows: [
      { type: 'road', speed: 2.6, dir: 1 },
      { type: 'road', speed: 3.1, dir: -1 },
      { type: 'safe' },
      { type: 'road', speed: 3.6, dir: 1 },
      { type: 'road', speed: 3.2, dir: -1 },
      { type: 'safe' },
    ],
  },
  {
    key: 'busstop',
    name: '버스 정류장',
    rows: [
      { type: 'safe' },
      { type: 'safe' },
      { type: 'bus', speed: 3.4, dir: -1, count: 2 },
      { type: 'bus', speed: 3.6, dir: 1 },
      { type: 'bus', speed: 3.8, dir: -1, count: 2 },
      { type: 'safe' },
      { type: 'bus', speed: 3.0, dir: 1, count: 2 },
      { type: 'bus', speed: 3.4, dir: -1 },
      { type: 'bus', speed: 3.6, dir: 1, count: 2 },
      { type: 'safe' },
      { type: 'bus', speed: 3.8, dir: -1, count: 2 },
      { type: 'bus', speed: 3.2, dir: 1 },
      { type: 'safe' },
      { type: 'bus', speed: 3.4, dir: 1, count: 2 },
      { type: 'bus', speed: 3.6, dir: -1 },
      { type: 'safe' },
      { type: 'bus', speed: 3.2, dir: 1, count: 2 },
      { type: 'bus', speed: 3.6, dir: -1 },
      { type: 'bus', speed: 3.8, dir: 1, count: 2 },
      { type: 'safe' },
      { type: 'bus', speed: 3.2, dir: -1, count: 2 },
      { type: 'safe' },
      { type: 'bus', speed: 3.6, dir: 1, count: 2 },
      { type: 'safe' },
    ],
  },
  {
    key: 'subway',
    name: '지하철 승강장',
    rows: [
      { type: 'safe' },
      { type: 'rail', period: 2.6, warning: 0.6, sweep: 0.8 },
      { type: 'safe' },
      { type: 'rail', period: 2.3, warning: 0.5, sweep: 0.8 },
      { type: 'rail', period: 2.4, warning: 0.5, sweep: 0.9 },
      { type: 'safe' },
      { type: 'rail', period: 2.2, warning: 0.5, sweep: 0.9 },
      { type: 'rail', period: 2.1, warning: 0.4, sweep: 1.0 },
      { type: 'safe' },
      { type: 'rail', period: 1.9, warning: 0.4, sweep: 1.0 },
      { type: 'safe' },
    ],
  },
  {
    key: 'plaza',
    name: '회사 앞 광장',
    rows: [
      { type: 'safe' },
      { type: 'safe' },
      { type: 'finish' },
    ],
  },
];

function buildRows() {
  const rows = [];
  let z = 0;
  for (const stage of STAGE_DEFS) {
    for (const rowDef of stage.rows) {
      rows.push({ z, stageKey: stage.key, stageName: stage.name, ...rowDef });
      z++;
    }
  }
  return rows;
}

export const ROWS = buildRows();
export const TOTAL_ROWS = ROWS.length;

export function stageNameAt(z) {
  const row = ROWS[Math.round(z)];
  return row ? row.stageName : '';
}
