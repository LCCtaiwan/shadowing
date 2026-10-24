// App 狀態：內容索引、進度、卡片、設定。所有寫入都同步存進 IndexedDB。
import * as db from './lib/db.js';
import { cardsFromEpisode } from './lib/cards.js';
import { schedule } from './lib/fsrs.js';
import { DEFAULT_LIMITS, dayKey } from './lib/srs.js';
import { isoDate } from './lib/schedule.js';

export const DEFAULT_SETTINGS = {
  ruby: 'furi', speed: 1, retention: 0.9, limits: DEFAULT_LIMITS, pauseFactor: 1.3, repeats: 2,
  reading: '新完全マスター 読解 N3', feedbackRepo: '',
};

export const S = {
  index: null, settings: { ...DEFAULT_SETTINGS }, progress: { episodes: {}, drills: {}, resume: {} },
  days: [], reading: {}, today: null, cards: [], episodes: new Map(), drills: new Map(), cast: {},
};

const CAST_FILES = ['story/ja/cast.json', 'story/ja/drama/cast.json', 'story/ja/anime/cast.json'];

// 測試用：網址加 ?today=2026-10-26 可模擬某天（只影響課程解鎖與首頁顯示）
const OVERRIDE = new URLSearchParams(location.search).get('today');
export const todayStr = () => (/^\d{4}-\d{2}-\d{2}$/.test(OVERRIDE || '') ? OVERRIDE : dayKey(Date.now()));

export async function boot() {
  const casts = await Promise.all(CAST_FILES.map(f => fetch(f).then(r => (r.ok ? r.json() : {})).catch(() => ({}))));
  S.cast = Object.assign({}, ...casts);
  const [index, settings, progress, days, reading, today, cards] = await Promise.all([
    fetch('scripts/index.json', { cache: 'no-cache' }).then(r => r.json()),
    db.kvGet('settings'), db.kvGet('progress'), db.kvGet('days'), db.kvGet('reading'), db.kvGet('today'), db.allCards(),
  ]);
  S.index = index;
  S.settings = { ...DEFAULT_SETTINGS, ...(settings || {}), limits: { ...DEFAULT_LIMITS, ...(settings?.limits || {}) } };
  S.progress = { episodes: {}, drills: {}, resume: {}, ...(progress || {}) };
  S.days = days || [];
  S.reading = reading || {};
  S.today = today?.day === todayStr() ? today : { day: todayStr(), newByDeck: {}, reviews: 0, notes: [] };
  S.cards = cards || [];
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

export { db, isoDate };
