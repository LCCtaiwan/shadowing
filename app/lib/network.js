// 單字的「神經元連結」：同漢字、劇中場景、搭配、相反、相關。學過的連結點亮，畫成放射狀 SVG。
import { esc } from './ruby.js';

const KANJI = /[㐀-鿿々]/g;
const TYPE = {
  scene: { label: '劇中場景', fill: 'var(--anime-tint)', stroke: 'var(--anime)', ink: 'var(--anime)' },
  kanji: { label: '同漢字', fill: 'var(--brand-tint)', stroke: 'var(--brand-strong)', ink: 'var(--brand)' },
  colloc: { label: '搭配', fill: 'var(--family-tint)', stroke: 'var(--family)', ink: 'var(--family)' },
  opposite: { label: '相反', fill: 'var(--warn-tint)', stroke: 'var(--warn)', ink: 'var(--warn)' },
  related: { label: '相關', fill: 'var(--surface-2)', stroke: 'var(--muted)', ink: 'var(--ink)' },
};

/** 已學過（不是新卡）的單字文字集合。 */
export function learnedWords(cards) {
  return new Set(cards.filter(c => c.deck === 'vocab' && c.state !== 'new').map(c => c.data.text));
}

/**
 * @param note 單字 note id（ja:vocab:…）
 * @param lexicon story/ja/lexicon.json 的內容
 * @param learned learnedWords() 的結果
 * @param scene { title, line }（劇中出處，可省略）
 */
export function buildNetwork(note, lexicon, learned, scene) {
  const v = lexicon?.vocab?.[note];
  if (!v) return null;
  const nodes = [];
  if (scene) nodes.push({ type: 'scene', text: scene.title, sub: '劇中場景', lit: true, line: scene.line });
  const links = v.links || {};
  for (const c of (links.collocations || []).slice(0, 2)) {
    nodes.push({ type: 'colloc', text: c.text, sub: c.zh, lit: learned.has(v.text) });
  }
  const kanji = new Set(v.text.match(KANJI) || []);
  if (kanji.size) {
    const same = Object.entries(lexicon.vocab)
      .filter(([id, x]) => id !== note && [...(x.text.match(KANJI) || [])].some(k => kanji.has(k)))
      .map(([, x]) => ({ type: 'kanji', text: x.text, reading: x.reading, sub: x.zh, lit: learned.has(x.text) }))
      .sort((a, b) => b.lit - a.lit)
      .slice(0, 3);
    nodes.push(...same);
  }
  for (const x of (links.opposite || []).slice(0, 1)) nodes.push({ type: 'opposite', text: x.text, reading: x.reading, sub: x.zh, lit: learned.has(x.text) });
  for (const x of (links.related || []).slice(0, 2)) nodes.push({ type: 'related', text: x.text, reading: x.reading, sub: x.zh, lit: learned.has(x.text) });
  return { center: v, nodes: nodes.slice(0, 8) };
}

const short = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** 放射狀連結圖。未點亮的節點是虛線、淡色。 */
export function renderNetwork(net) {
  if (!net || !net.nodes.length) return '';
  const W = 320, H = 300, cx = W / 2, cy = H / 2, R = 108;
  const n = net.nodes.length;
  const pos = net.nodes.map((_, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [cx + R * Math.cos(a), cy + R * Math.sin(a) * 0.92];
  });
  const lines = net.nodes.map((nd, i) => `<line x1="${cx}" y1="${cy}" x2="${pos[i][0].toFixed(1)}" y2="${pos[i][1].toFixed(1)}"
    stroke="${nd.lit ? TYPE[nd.type].stroke : 'var(--line)'}" stroke-width="${nd.lit ? 2.5 : 1.5}" ${nd.lit ? '' : 'stroke-dasharray="4 4"'}/>`).join('');
  const circles = net.nodes.map((nd, i) => {
    const t = TYPE[nd.type];
    const [x, y] = pos[i];
    return `<g opacity="${nd.lit ? 1 : 0.55}">
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="34" fill="${t.fill}" stroke="${t.stroke}" stroke-width="1.5" ${nd.lit ? '' : 'stroke-dasharray="3 3"'}/>
      <text x="${x.toFixed(1)}" y="${(y - 3).toFixed(1)}" text-anchor="middle" font-size="12" font-weight="700" fill="${t.ink}">${esc(short(nd.text, 7))}</text>
      <text x="${x.toFixed(1)}" y="${(y + 12).toFixed(1)}" text-anchor="middle" font-size="9.5" fill="var(--muted)">${esc(short(nd.type === 'scene' ? t.label : nd.sub || t.label, 7))}</text></g>`;
  }).join('');
  const lit = net.nodes.filter(nd => nd.lit).length;
  return `<figure class="net" style="margin:0">
    <figcaption class="row between muted"><span>神經元連結</span><span class="num">點亮 ${lit} / ${n}</span></figcaption>
    <svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(net.center.text)} 的連結：${net.nodes.map(nd => `${TYPE[nd.type].label} ${nd.text}`).join('、')}">
      ${lines}
      <circle cx="${cx}" cy="${cy}" r="44" fill="var(--brand-strong)"/>
      <text x="${cx}" y="${cy - 2}" text-anchor="middle" font-size="19" font-weight="700" fill="var(--on-brand)">${esc(short(net.center.text, 6))}</text>
      <text x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="11" fill="var(--on-brand)">${esc(short(net.center.reading, 9))}</text>
      ${circles}
    </svg>
    <div class="row wrap muted" style="gap:10px;font-size:12px">${Object.entries(TYPE).filter(([k]) => net.nodes.some(nd => nd.type === k)).map(([, t]) => `<span><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${t.fill};border:1.5px solid ${t.stroke};vertical-align:-1px"></span> ${t.label}</span>`).join('')}<span>虛線＝還沒學到</span></div>
  </figure>`;
}

/** 連結題的選項：正解＋2 個同詞性的干擾項（依卡片 id 固定順序）。 */
export function linkQuestion(note, lexicon, seedText) {
  const v = lexicon?.vocab?.[note];
  const c = v?.links?.collocations?.[0];
  if (!c) return null;
  const answer = c.text.slice(c.cue.length);
  const posKey = (v.pos || '').slice(0, 2);
  let h = 0;
  for (const ch of seedText) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pool = Object.entries(lexicon.vocab)
    .filter(([id, x]) => id !== note && x.text !== answer && (x.pos || '').slice(0, 2) === posKey)
    .map(([, x]) => x.text);
  const pick = [];
  while (pick.length < 2 && pool.length) pick.push(pool.splice((h = (h * 1103515245 + 12345) >>> 0) % pool.length, 1)[0]);
  const options = [answer, ...pick];
  const shift = h % options.length;
  return { cue: c.cue, zh: c.zh, full: c.text, answer, options: [...options.slice(shift), ...options.slice(0, shift)] };
}
