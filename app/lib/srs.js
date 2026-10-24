// 每日複習佇列：學習中 → 到期 → 新卡；子牌組交錯；兄弟卡同日只出一張；每日上限。
import { DECKS } from './cards.js';

export const DEFAULT_LIMITS = { new: { sentence: 8, vocab: 20, phrase: 6, grammar: 2 }, review: 200 };
const LEARN_AHEAD = 20 * 60e3;

export function dayKey(ms, rolloverHour = 4) {
  const d = new Date(ms - rolloverHour * 3600e3);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function endOfDay(ms, rolloverHour = 4) {
  const d = new Date(ms - rolloverHour * 3600e3);
  d.setHours(24 + rolloverHour, 0, 0, 0);
  return d.getTime();
}

function interleave(groups) {
  const out = [];
  const lists = DECKS.map(k => [...(groups[k] || [])]);
  while (lists.some(l => l.length)) for (const l of lists) if (l.length) out.push(l.shift());
  return out;
}

/**
 * @param cards 全部卡片
 * @param now 現在時間（ms）
 * @param today 今日統計 { newByDeck: {deck: n}, reviews: n, notes: Set<note> 今天已複習過的 note }
 */
export function buildQueue(cards, now, today, limits = DEFAULT_LIMITS, level = null) {
  const active = cards.filter(c => !c.suspended && (!level || c.level === level));
  const eod = endOfDay(now);
  const learning = active.filter(c => (c.state === 'learning' || c.state === 'relearning')).sort((a, b) => a.due - b.due);
  const busyNotes = new Set(today.notes || []);
  for (const c of learning) busyNotes.add(c.note);

  const reviewLeft = Math.max(0, limits.review - (today.reviews || 0));
  const dueByDeck = {};
  for (const c of active.filter(c => c.state === 'review' && c.due < eod).sort((a, b) => a.due - b.due)) {
    if (busyNotes.has(c.note)) continue;
    busyNotes.add(c.note);
    (dueByDeck[c.deck] ||= []).push(c);
  }
  const review = interleave(dueByDeck).slice(0, reviewLeft);

  const newByDeck = {};
  for (const deck of DECKS) {
    const left = Math.max(0, (limits.new[deck] ?? 0) - (today.newByDeck?.[deck] || 0));
    const picked = [];
    for (const c of active.filter(c => c.deck === deck && c.state === 'new').sort((a, b) => a.order - b.order)) {
      if (picked.length >= left) break;
      if (busyNotes.has(c.note)) continue;
      busyNotes.add(c.note);
      picked.push(c);
    }
    newByDeck[deck] = picked;
  }
  const fresh = interleave(newByDeck);
  return { learning, review, fresh, now };
}

/**
 * 從佇列挑下一張：到期的學習卡優先，其次到期卡、新卡，最後是 20 分鐘內的學習卡。
 * 到期卡依今天已複習數輪流各子牌組；新卡挑「今天額度用得最少」的子牌組，讓四種卡交錯出現。
 */
export function nextCard(queue, now, today = {}, limits = DEFAULT_LIMITS) {
  const dueLearning = queue.learning.find(c => c.due <= now);
  if (dueLearning) return dueLearning;
  if (queue.review.length) {
    const decks = DECKS.filter(d => queue.review.some(c => c.deck === d));
    const deck = decks[(today.reviews || 0) % decks.length];
    return queue.review.find(c => c.deck === deck);
  }
  if (queue.fresh.length) {
    const used = d => (today.newByDeck?.[d] || 0) / Math.max(1, limits.new[d] || 1);
    const deck = DECKS.filter(d => queue.fresh.some(c => c.deck === d)).sort((a, b) => used(a) - used(b))[0];
    return queue.fresh.find(c => c.deck === deck);
  }
  const soon = queue.learning.find(c => c.due <= now + LEARN_AHEAD);
  return soon || null;
}

/** 各子牌組的「新／學習／到期」數，給牌組總覽用。 */
export function deckCounts(queue) {
  const counts = Object.fromEntries(DECKS.map(d => [d, { new: 0, learn: 0, due: 0 }]));
  for (const c of queue.fresh) counts[c.deck].new++;
  for (const c of queue.learning) if (c.due < endOfDay(queue.now)) counts[c.deck].learn++;
  for (const c of queue.review) counts[c.deck].due++;
  return counts;
}

/** 粗估分鐘數：新卡 20 秒、複習 10 秒、學習中 12 秒。 */
export function estimateMinutes(counts) {
  let s = 0;
  for (const c of Object.values(counts)) s += c.new * 20 + c.due * 10 + c.learn * 12;
  return Math.round(s / 60);
}
