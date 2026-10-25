// App 狀態：內容索引、進度、卡片、設定。所有寫入都同步存進 IndexedDB。
import * as db from './lib/db.js';
import { cardsFromEpisode, cardsFromJlpt } from './lib/cards.js';
import { schedule } from './lib/fsrs.js';
import { DEFAULT_LIMITS, dayKey } from './lib/srs.js';
import { isoDate } from './lib/schedule.js';

export const DEFAULT_SETTINGS = {
  ruby: 'furi', speed: 1, retention: 0.9, limits: DEFAULT_LIMITS, pauseFactor: 1.3, repeats: 2,
  reading: '新完全マスター 読解 N3', feedbackRepo: '',
  plan: { current: 'none', target: 'N3', examDate: '2027-07-04', autoDaily: true },
  writeCards: true,
};

export const S = {
  index: null, settings: { ...DEFAULT_SETTINGS }, progress: { episodes: {}, drills: {}, resume: {} },
  days: [], reading: {}, today: null, cards: [], episodes: new Map(), drills: new Map(), cast: {}, lexicon: { vocab: {} },
  screen: {}, jlpt: new Map(),
};

const CAST_FILES = ['story/ja/cast.json', 'story/ja/drama/cast.json', 'story/ja/anime/cast.json', 'story/ja/family/cast.json'];

// 測試用：網址加 ?today=2026-10-26 可模擬某天（只影響課程解鎖與首頁顯示）
const OVERRIDE = new URLSearchParams(location.search).get('today');
export const todayStr = () => (/^\d{4}-\d{2}-\d{2}$/.test(OVERRIDE || '') ? OVERRIDE : dayKey(Date.now()));

export async function boot() {
  const casts = await Promise.all(CAST_FILES.map(f => fetch(f).then(r => (r.ok ? r.json() : {})).catch(() => ({}))));
  S.cast = Object.assign({}, ...casts);
  S.lexicon = await fetch('story/ja/lexicon.json').then(r => (r.ok ? r.json() : { vocab: {} })).catch(() => ({ vocab: {} }));
  const [index, settings, progress, days, reading, today, cards, screen] = await Promise.all([
    fetch('scripts/index.json', { cache: 'no-cache' }).then(r => r.json()),
    db.kvGet('settings'), db.kvGet('progress'), db.kvGet('days'), db.kvGet('reading'), db.kvGet('today'), db.allCards(), db.kvGet('screen'),
  ]);
  S.screen = screen || {};
  S.index = index;
  S.settings = { ...DEFAULT_SETTINGS, ...(settings || {}), limits: { ...DEFAULT_LIMITS, ...(settings?.limits || {}) },
    plan: { ...DEFAULT_SETTINGS.plan, ...(settings?.plan || {}) } };
  S.progress = { episodes: {}, drills: {}, resume: {}, ...(progress || {}) };
  S.days = days || [];
  S.reading = reading || {};
  S.today = today?.day === todayStr() ? today : { day: todayStr(), newByDeck: {}, reviews: 0, notes: [] };
  S.cards = cards || [];
  await ensureWriteCards();
}

/** 舊的單字卡補上手寫卡（關掉手寫卡時暫停所有手寫卡）。 */
export async function ensureWriteCards() {
  const changed = [];
  const have = new Set(S.cards.map(c => c.id));
  if (S.settings.writeCards) {
    const listen = S.cards.filter(c => c.kind === 'vocab-listen');
    let order = S.cards.reduce((m, c) => Math.max(m, c.order || 0), 0);
    for (const c of listen) {
      const id = `${c.note}#write`;
      if (have.has(id)) continue;
      const w = { ...c, id, kind: 'vocab-write', order: ++order, state: 'new', due: 0, s: 0, d: 0, reps: 0, lapses: 0, step: 0, last: 0, suspended: c.suspended };
      S.cards.push(w);
      changed.push(w);
    }
  }
  for (const c of S.cards) {
    if (c.kind !== 'vocab-write') continue;
    const want = !S.settings.writeCards;
    if (Boolean(c.writeOff) !== want) { c.writeOff = want; c.suspended = want || (c.known || false); changed.push(c); }
  }
  if (changed.length) await db.putCards(changed);
}

export async function loadEpisode(meta) {
  if (!S.episodes.has(meta.id)) S.episodes.set(meta.id, fetch(meta.path).then(r => r.json()));
  return S.episodes.get(meta.id);
}

export async function loadDrill(meta) {
  if (!S.drills.has(meta.id)) S.drills.set(meta.id, fetch(meta.path).then(r => r.json()));
  return S.drills.get(meta.id);
}

export const saveSettings = () => db.kvSet('settings', S.settings);
export const saveProgress = () => db.kvSet('progress', S.progress);

export async function markPracticed() {
  const d = todayStr();
  if (!S.days.includes(d)) {
    S.days.push(d);
    await db.kvSet('days', S.days);
  }
}

export async function toggleReading() {
  const d = todayStr();
  S.reading[d] = !S.reading[d];
  await db.kvSet('reading', S.reading);
  if (S.reading[d]) await markPracticed();
}

export async function saveResume(episodeId, step, lineIdx) {
  S.progress.resume[episodeId] = { step, lineIdx, at: Date.now() };
  await saveProgress();
}

export async function finishEpisode(meta, ep, chosenIds, difficulty) {
  const existing = new Set(S.cards.map(c => c.id));
  const maxOrder = S.cards.reduce((m, c) => Math.max(m, c.order || 0), 0);
  const fresh = cardsFromEpisode(ep, meta, maxOrder + 1).filter(c => !existing.has(c.id) && chosenIds.has(c.id));
  S.cards.push(...fresh);
  await db.putCards(fresh);
  S.progress.episodes[meta.id] = { done: true, at: Date.now(), difficulty, week: meta.week };
  delete S.progress.resume[meta.id];
  await saveProgress();
  await markPracticed();
  return fresh.length;
}

export async function setDifficulty(id, difficulty) {
  if (S.progress.episodes[id]) {
    S.progress.episodes[id].difficulty = difficulty;
    await saveProgress();
  }
}

export async function finishDrill(meta, results) {
  S.progress.drills[meta.id] = { done: true, at: Date.now(), results, kind: meta.kind, week: meta.week };
  await saveProgress();
  await markPracticed();
}

async function saveToday() {
  await db.kvSet('today', S.today);
}

export async function rate(card, g) {
  const now = Date.now();
  if (S.today.day !== todayStr()) S.today = { day: todayStr(), newByDeck: {}, reviews: 0, notes: [] };
  const wasNew = card.state === 'new';
  const next = { ...card, ...schedule(card, g, now, S.settings.retention) };
  const i = S.cards.findIndex(c => c.id === card.id);
  S.cards[i] = next;
  if (wasNew) S.today.newByDeck[card.deck] = (S.today.newByDeck[card.deck] || 0) + 1;
  else if (card.state === 'review') S.today.reviews += 1;
  if (!S.today.notes.includes(card.note)) S.today.notes.push(card.note);
  if (next.lapses >= 8 && !next.flagged) next.flagged = true;
  await Promise.all([db.putCards([next]), db.addLog({ id: card.id, deck: card.deck, g, at: now, from: card.state }), saveToday(), markPracticed()]);
  return next;
}

export async function updateCard(card) {
  const i = S.cards.findIndex(c => c.id === card.id);
  S.cards[i] = card;
  await db.putCards([card]);
}

export async function loadJlpt(meta) {
  if (!S.jlpt.has(meta.level)) S.jlpt.set(meta.level, fetch(meta.path).then(r => (r.ok ? r.json() : [])).catch(() => []));
  return S.jlpt.get(meta.level);
}

/** 滑卡篩選：known = 我會了（已有的卡也暫停）、learn = 我要學（建立新卡）。 */
export async function screenWord(v, meta, choice) {
  S.screen[v.id] = { choice, at: Date.now(), level: v.level };
  if (choice === 'learn') {
    const existing = new Set(S.cards.map(c => c.id));
    const maxOrder = S.cards.reduce((m, c) => Math.max(m, c.order || 0), 0);
    const fresh = cardsFromJlpt(v, meta, maxOrder + 1).filter(c => !existing.has(c.id));
    S.cards.push(...fresh);
    await db.putCards(fresh);
  } else {
    const mine = S.cards.filter(c => c.note === v.id && !c.suspended);
    for (const c of mine) { c.suspended = true; c.known = true; }
    if (mine.length) await db.putCards(mine);
  }
  await db.kvSet('screen', S.screen);
}

export async function undoScreen(v) {
  const prev = S.screen[v.id];
  delete S.screen[v.id];
  if (prev?.choice === 'known') {
    const mine = S.cards.filter(c => c.note === v.id && c.known);
    for (const c of mine) { c.suspended = false; delete c.known; }
    if (mine.length) await db.putCards(mine);
  } else if (prev?.choice === 'learn') {
    const keep = S.cards.filter(c => !(c.note === v.id && c.src?.series === 'jlpt' && c.state === 'new'));
    const removed = S.cards.filter(c => !keep.includes(c));
    S.cards = keep;
    if (removed.length) await db.deleteCards(removed.map(c => c.id));
  }
  await db.kvSet('screen', S.screen);
}

/** 每日上限：開啟「依考試日自動調整」時，新單字上限＝計畫建議量（5–60）。 */
export function effectiveLimits() {
  const l = S.settings.limits;
  if (!S.settings.plan.autoDaily || !S.index?.jlpt?.length) return l;
  const daily = Math.min(60, Math.max(5, studyPlan().daily));
  return { ...l, new: { ...l.new, vocab: daily } };
}

const ORDER = ['N5', 'N4', 'N3', 'N2', 'N1'];
/** 依「目前級別、目標級別、考試日」算出還要背幾個、每天幾個。 */
export function studyPlan(today = todayStr()) {
  const { current, target, examDate } = S.settings.plan;
  const from = current === 'none' ? -1 : ORDER.indexOf(current), to = ORDER.indexOf(target);
  const levels = (S.index.jlpt || []).filter(l => { const i = ORDER.indexOf(l.level); return i > from && i <= to; });
  const total = levels.reduce((a, l) => a + l.count, 0);
  const ids = new Set(Object.keys(S.screen));
  const learnedNotes = new Set(S.cards.filter(c => c.deck === 'vocab' && c.state !== 'new').map(c => c.note));
  const handled = [...ids].filter(id => S.screen[id].choice === 'known').length + learnedNotes.size;
  const remaining = Math.max(0, total - handled);
  const days = Math.max(1, Math.round((Date.parse(examDate) - Date.parse(today)) / 864e5));
  return { levels: levels.map(l => l.level), total, remaining, days, daily: Math.ceil(remaining / days) };
}

export { db, isoDate };
