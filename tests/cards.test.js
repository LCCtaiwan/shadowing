import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cardsFromEpisode, clozeParts } from '../app/lib/cards.js';
import { buildQueue, nextCard, deckCounts, dayKey } from '../app/lib/srs.js';
import { renderRuby } from '../app/lib/ruby.js';
import { todayTasks, streak, isUnlocked } from '../app/lib/schedule.js';

const load = p => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));
const index = load('scripts/index.json');
const meta = index.episodes[0];
const ep = load(meta.path);
const T0 = Date.UTC(2026, 9, 26, 3);

test('每集產生四種卡，id 穩定且不重複', () => {
  const a = cardsFromEpisode(ep, meta), b = cardsFromEpisode(ep, meta);
  assert.deepEqual(a.map(c => c.id), b.map(c => c.id));
  assert.equal(new Set(a.map(c => c.id)).size, a.length);
  for (const deck of ['sentence', 'vocab', 'phrase', 'grammar']) assert.ok(a.some(c => c.deck === deck), deck);
  assert.equal(a.filter(c => c.deck === 'grammar').length, 2);
});

test('有漢字的單字多一張「看字讀音」兄弟卡；複習單字也產卡（id 相同，加入時去重）', () => {
  const cards = cardsFromEpisode(ep, meta);
  const v = ep.vocab.find(x => /[一-鿿]/.test(x.text) && !x.review);
  assert.ok(cards.find(c => c.id === `${v.id}#listen`));
  assert.ok(cards.find(c => c.id === `${v.id}#read`));
  const later = load('scripts/ja/drama/w02/e05.json');
  const reviewed = later.vocab.filter(x => x.review).map(x => x.id);
  const laterCards = cardsFromEpisode(later, index.episodes.find(e => e.id === later.id));
  assert.ok(reviewed.length > 0);
  for (const id of reviewed) assert.ok(laterCards.some(c => c.id === `${id}#listen`));
});

test('片語填空：surface 一定切得出來', () => {
  for (const c of cardsFromEpisode(ep, meta).filter(c => c.kind === 'phrase-cloze')) {
    assert.ok(clozeParts(c.data.line.text, c.data.surface));
  }
});

test('佇列：遵守每日新卡上限，兄弟卡同日只出一張', () => {
  const cards = cardsFromEpisode(ep, meta);
  const q = buildQueue(cards, T0, { newByDeck: {}, reviews: 0, notes: [] });
  const counts = deckCounts(q);
  assert.equal(counts.vocab.new, Math.min(20, new Set(cards.filter(c => c.deck === 'vocab').map(c => c.note)).size));
  assert.ok(counts.sentence.new <= 8);
  const notes = q.fresh.map(c => c.note);
  assert.equal(new Set(notes).size, notes.length);
  assert.ok(nextCard(q, T0));
});

test('佇列：今天已用掉的新卡額度要扣掉', () => {
  const cards = cardsFromEpisode(ep, meta);
  const q = buildQueue(cards, T0, { newByDeck: { vocab: 18, sentence: 8 }, reviews: 0, notes: [] });
  assert.equal(deckCounts(q).vocab.new, 2);
  assert.equal(deckCounts(q).sentence.new, 0);
});

test('凌晨 4 點前算前一天', () => {
  assert.equal(dayKey(new Date(2026, 9, 27, 3, 0).getTime()), '2026-10-26');
  assert.equal(dayKey(new Date(2026, 9, 27, 5, 0).getTime()), '2026-10-27');
});

test('ruby：三種模式與重點標示', () => {
  const r = [['お'], ['弁当', 'べんとう'], ['、'], ['温', 'あたた'], ['めますか？']];
  assert.equal(renderRuby(r, 'furi'), 'お<ruby>弁当<rt>べんとう</rt></ruby>、<ruby>温<rt>あたた</rt></ruby>めますか？');
  assert.equal(renderRuby(r, 'kana'), 'おべんとう、あたためますか？');
  assert.match(renderRuby(r, 'furi', ['温めますか']), /<mark><ruby>温<rt>あたた<\/rt><\/ruby>めますか<\/mark>？/);
});

test('今日任務：依順序給下一話，開課日前也能先開始；漏掉的照順序補', () => {
  const t = todayTasks(index, { episodes: {}, drills: {} }, '2026-10-28');
  assert.equal(t.episode.id, 'ja-drama-w01-e01');
  assert.equal(t.behind, index.episodes.filter(e => e.date <= '2026-10-28').length);
  const done = { 'ja-drama-w01-e01': true, 'ja-anime-w01-e01': true, 'ja-drama-w01-e02': true };
  assert.equal(todayTasks(index, { episodes: done, drills: {} }, '2026-10-28').episode.id, 'ja-family-w01-e01');
  assert.equal(todayTasks(index, { episodes: {}, drills: {} }, '2026-10-20').episode.id, 'ja-drama-w01-e01');
});

test('解鎖：到日期的、做完的、下一個要做的', () => {
  const eps = index.episodes;
  const done = { [eps[0].id]: true };
  assert.ok(isUnlocked(eps[1], eps, '2026-10-20', done));
  assert.ok(!isUnlocked(eps[2], eps, '2026-10-20', done));
  assert.ok(isUnlocked(eps[2], eps, '2026-10-28', done));
});

test('連續天數', () => {
  assert.equal(streak(['2026-10-25', '2026-10-26', '2026-10-27'], '2026-10-27'), 3);
  assert.equal(streak(['2026-10-25', '2026-10-26'], '2026-10-27'), 2);
  assert.equal(streak(['2026-10-24'], '2026-10-27'), 0);
});

test('新卡交錯：今天某子牌組用掉較多額度時，先出其他子牌組', () => {
  const cards = cardsFromEpisode(ep, meta);
  const today = { newByDeck: { sentence: 3 }, reviews: 0, notes: [] };
  const q = buildQueue(cards, T0, today);
  assert.notEqual(nextCard(q, T0, today).deck, 'sentence');
});

test('JLPT 單字：有漢字三張卡（聽、讀、連結），id 與劇中單字共用', async () => {
  const { cardsFromJlpt } = await import('../app/lib/cards.js');
  const v = { id: 'ja:vocab:会う', text: '会う', reading: 'あう', level: 'N5', zh: '見面', pos: '動詞',
    example: { text: '駅で会います。', ruby: [['駅', 'えき'], ['で'], ['会', 'あ'], ['います。']], zh: '在車站見面。' },
    links: { collocations: [{ cue: '友だちに', text: '友だちに会う', zh: '和朋友見面' }] } };
  const cards = cardsFromJlpt(v, { audio: 'audio/ja/jlpt/n5' });
  assert.deepEqual(cards.map(c => c.kind), ['vocab-listen', 'vocab-read', 'vocab-link']);
  assert.equal(cards[0].id, 'ja:vocab:会う#listen');
  assert.equal(cards[0].data.example.audioKey, 'ja:vocab:会う#ex');
});
