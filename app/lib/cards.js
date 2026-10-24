// 由劇本產生 Anki 式卡片。一筆資料（note）可產生多張卡；同一 note 的卡互為兄弟卡。
import { newCardState } from './fsrs.js';

export const DECKS = ['sentence', 'vocab', 'phrase', 'grammar'];
export const DECK_NAMES = { sentence: '句子聽力', vocab: '單字', phrase: '片語', grammar: '文法' };
const KANJI = /[㐀-鿿々]/;

const lineMap = ep => Object.fromEntries(ep.scenes.flatMap(sc => sc.lines.map(l => [l.id, l])));

/**
 * @param ep 劇本 JSON
 * @param meta 索引中的該集資料（需有 audio、series、date）
 * @param seq 起始排序號（新卡依此順序出現）
 */
export function cardsFromEpisode(ep, meta, seq = 0) {
  const lines = lineMap(ep);
  const src = { episode: ep.id, series: ep.series, week: ep.week, no: ep.episode, title: ep.title, audio: meta.audio };
  const out = [];
  const add = (id, note, deck, kind, level, data) =>
    out.push({ id, note, deck, kind, level, order: seq + out.length, src, data, suspended: false, flagged: false, ...newCardState() });

  for (const sc of ep.scenes) {
    for (const l of sc.lines) {
      if (l.card === false) continue;
      add(`ja:sent:${ep.id}:${l.id}`, `ja:sent:${ep.id}:${l.id}`, 'sentence', 'sentence', ep.level,
        { speaker: l.speaker, text: l.text, ruby: l.ruby, zh: l.zh, audioKey: l.id });
    }
  }
  // 三部劇可任選順序，所以標了 review 的單字也產卡；已在牌組裡的卡由 finishEpisode 依 id 略過
  for (const v of ep.vocab) {
    const ex = lines[v.line];
    const data = { text: v.text, reading: v.reading, pos: v.pos, zh: v.zh, audioKey: v.id,
      example: ex && { text: ex.text, ruby: ex.ruby, zh: ex.zh, audioKey: ex.id } };
    add(`${v.id}#listen`, v.id, 'vocab', 'vocab-listen', v.level, data);
    if (KANJI.test(v.text)) add(`${v.id}#read`, v.id, 'vocab', 'vocab-read', v.level, data);
    if (v.links?.collocations?.length) add(`${v.id}#link`, v.id, 'vocab', 'vocab-link', v.level, data);
  }
  for (const p of ep.phrases) {
    const l = lines[p.line];
    if (!l) continue;
    add(`${p.id}#cloze`, p.id, 'phrase', 'phrase-cloze', ep.level,
      { text: p.text, zh: p.zh, surface: p.surface, line: { text: l.text, ruby: l.ruby, zh: l.zh, audioKey: l.id } });
  }
  ep.grammar.forEach((g, gi) => {
    const l = lines[g.line];
    add(`${g.id}#example`, g.id, 'grammar', 'grammar', g.level, {
      pattern: g.pattern, zh: g.zh, surface: g.surface,
      line: l && { text: l.text, ruby: l.ruby, zh: l.zh, audioKey: l.id },
      examples: g.examples.map((ex, ei) => ({ ...ex, audioKey: `g${gi + 1}-ex${ei + 1}` })),
    });
  });
  return out;
}

/** 把句子切成「填空前、空格、填空後」。找不到 surface 時回傳 null。 */
export function clozeParts(text, surface) {
  const i = text.indexOf(surface);
  return i < 0 ? null : [text.slice(0, i), surface, text.slice(i + surface.length)];
}
