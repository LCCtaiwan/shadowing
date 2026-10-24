// FSRS-5 排程（Anki 現行預設演算法）的精簡實作，含 Anki 式學習步驟。
// 評分：1 重來、2 困難、3 良好、4 簡單。時間單位：毫秒（due、last），穩定度單位：天。

export const W = [0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192,
  1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621];
const DECAY = -0.5;
const FACTOR = 19 / 81;
export const MIN = 60e3;
export const DAY = 864e5;
export const LEARN_STEPS = [1 * MIN, 10 * MIN];
export const RELEARN_STEPS = [10 * MIN];
const MAX_IVL = 36500;

const clampD = d => Math.min(10, Math.max(1, d));
export const retrievability = (days, s) => Math.pow(1 + FACTOR * days / s, DECAY);
export const nextInterval = (s, retention) =>
  Math.min(MAX_IVL, Math.max(1, Math.round(s / FACTOR * (Math.pow(retention, 1 / DECAY) - 1))));

const initS = g => Math.max(W[g - 1], 0.1);
const initD = g => clampD(W[4] - Math.exp(W[5] * (g - 1)) + 1);
const nextD = (d, g) => clampD(W[7] * initD(4) + (1 - W[7]) * (d - W[6] * (g - 3) * (10 - d) / 9));
const recallS = (d, s, r, g) => s * (Math.exp(W[8]) * (11 - d) * Math.pow(s, -W[9]) *
  (Math.exp(W[10] * (1 - r)) - 1) * (g === 2 ? W[15] : 1) * (g === 4 ? W[16] : 1) + 1);
const forgetS = (d, s, r) => Math.min(s, W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r)));
const shortS = (s, g) => s * Math.exp(W[17] * (g - 3 + W[18]));

export function newCardState() {
  return { state: 'new', due: 0, s: 0, d: 0, reps: 0, lapses: 0, step: 0, last: 0 };
}

function stepped(c, g, now, steps, retention) {
  if (g === 1) {
    c.step = 0;
    c.due = now + steps[0];
  } else if (g === 2) {
    c.due = now + (c.step === 0 && steps.length > 1 ? (steps[0] + steps[1]) / 2 : steps[c.step]);
  } else if (g === 3 && c.step + 1 < steps.length) {
    c.step += 1;
    c.due = now + steps[c.step];
  } else {
    const good = nextInterval(c.s, retention);
    const ivl = g === 4 ? Math.max(good + 1, nextInterval(c.s, retention)) : good;
    c.state = 'review';
    c.step = 0;
    c.due = now + ivl * DAY;
  }
  c.last = now;
  return c;
}

/** 回傳評分後的新卡片狀態（不改動原物件）。 */
export function schedule(card, g, now, retention = 0.9) {
  const c = { ...card, reps: card.reps + 1 };
  if (c.state === 'new') {
    c.s = initS(g);
    c.d = initD(g);
    c.state = 'learning';
    c.step = 0;
    return stepped(c, g, now, LEARN_STEPS, retention);
  }
  if (c.state === 'learning' || c.state === 'relearning') {
    c.s = shortS(c.s, g);
    c.d = nextD(c.d, g);
    return stepped(c, g, now, c.state === 'learning' ? LEARN_STEPS : RELEARN_STEPS, retention);
  }
  const days = Math.max(0, (now - c.last) / DAY);
  const r = retrievability(days, card.s);
  c.d = nextD(card.d, g);
  c.last = now;
  if (g === 1) {
    c.s = forgetS(card.d, card.s, r);
    c.lapses += 1;
    c.state = 'relearning';
    c.step = 0;
    c.due = now + RELEARN_STEPS[0];
    return c;
  }
  const s = { 2: recallS(card.d, card.s, r, 2), 3: recallS(card.d, card.s, r, 3), 4: recallS(card.d, card.s, r, 4) };
  let i2 = nextInterval(s[2], retention), i3 = nextInterval(s[3], retention), i4 = nextInterval(s[4], retention);
  i2 = Math.min(i2, i3);
  i3 = Math.max(i3, i2 + 1);
  i4 = Math.max(i4, i3 + 1);
  c.s = s[g];
  c.due = now + { 2: i2, 3: i3, 4: i4 }[g] * DAY;
  return c;
}

/** 四個按鈕各自的下次間隔（毫秒）。 */
export const preview = (card, now, retention = 0.9) => [1, 2, 3, 4].map(g => schedule(card, g, now, retention).due - now);

export function formatInterval(ms) {
  if (ms < 60 * MIN) return `${Math.max(1, Math.round(ms / MIN))}分`;
  if (ms < DAY) return `${Math.round(ms / (60 * MIN))}時間`;
  const d = Math.round(ms / DAY);
  if (d < 30) return `${d}日`;
  if (d < 365) return `${Math.round(d / 30)}か月`;
  return `${(d / 365).toFixed(1)}年`;
}
