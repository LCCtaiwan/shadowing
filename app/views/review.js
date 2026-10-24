// Anki 式複習：牌組總覽 → 一張張卡片 → 四段評分（按鈕顯示下次間隔）。另有卡片一覽（搜尋、暫停）。
import { S, rate, updateCard } from '../state.js';
import { $, $$, ICON, esc, toast, speakerName } from '../ui.js';
import { renderRuby, kanaText } from '../lib/ruby.js';
import { play, stop } from '../lib/audio.js';
import { buildQueue, nextCard, deckCounts, estimateMinutes } from '../lib/srs.js';
import { preview, formatInterval } from '../lib/fsrs.js';
import { DECKS, DECK_NAMES, clozeParts } from '../lib/cards.js';
import { go } from '../main.js';

const LEVELS = [null, 'N5', 'N4', 'N3', 'N2'];
const RATES = [['もう一度', 'again'], ['難しい', ''], ['正解', 'goodr'], ['簡単', '']];
const KIND_HINT = {
  sentence: '聴いて、シャドーしてから答えを見る', 'vocab-listen': '聴いて意味を思い出す', 'vocab-read': '読み方は？',
  'phrase-cloze': '聴いて空欄を埋める', grammar: 'この文型の意味は？',
};

export default function review(root, [mode]) {
  let level = null;
  let session = 0;

  if (mode === 'browse') return browse();
  overview();

  function queue() { return buildQueue(S.cards, Date.now(), S.today, S.settings.limits, level); }

  function overview() {
    const q = queue();
    const counts = deckCounts(q);
    const total = Object.values(counts).reduce((a, c) => a + c.new + c.learn + c.due, 0);
    root.innerHTML = `
      <div class="row between"><h1>復習</h1><button class="ghost" id="browse">カード一覧</button></div>
      ${S.cards.length ? `
      <div class="card" style="padding-block:4px">
        <div class="deck muted" style="font-size:12px"><span>デッキ</span><b class="c-new">新</b><b class="c-learn">学習</b><b class="c-due">期限</b></div>
        ${DECKS.map(d => `<div class="deck"><span>${DECK_NAMES[d]}</span><b class="c-new">${counts[d].new}</b><b class="c-learn">${counts[d].learn}</b><b class="c-due">${counts[d].due}</b></div>`).join('')}
      </div>
      <div class="row between muted"><span>FSRS・目標記憶率 ${Math.round(S.settings.retention * 100)}%</span><span>約 ${Math.max(total ? 1 : 0, estimateMinutes(counts))} 分</span></div>
      <div class="seg" role="group" aria-label="級">${LEVELS.map(l => `<button data-level="${l || ''}" aria-pressed="${l === level}">${l || 'すべて'}</button>`).join('')}</div>
      <button class="cta" id="start">${total ? '復習を始める' : '今日の分は終わりました'}</button>
      <p class="muted">卡片 ${S.cards.length} 張・今天已複習 ${S.today.reviews} 張、新卡 ${Object.values(S.today.newByDeck).reduce((a, b) => a + b, 0)} 張</p>`
      : `<div class="card empty stack"><h2>還沒有卡片</h2><p class="muted">完成一話的最後一步「カードに追加」，單字、片語、文法和句子就會進到這裡。</p><button class="cta" id="toHome">今日の一話へ</button></div>`}`;
    $('#browse', root).addEventListener('click', () => go('review/browse'));
    $('#toHome', root)?.addEventListener('click', () => go('home'));
    $$('[data-level]', root).forEach(b => b.addEventListener('click', () => { level = b.dataset.level || null; overview(); }));
    $('#start', root)?.addEventListener('click', () => (total ? show() : go('home')));
  }

  function show() {
    stop();
    const q = queue();
    const c = nextCard(q, Date.now(), S.today, S.settings.limits);
    const left = q.review.length + q.fresh.length + q.learning.filter(x => x.due <= Date.now() + 20 * 60e3).length;
    if (!c) {
      const later = q.learning[0];
      root.innerHTML = `<h1 class="ep-title">今日の復習、完了</h1>
        <p class="muted">${later ? `還有 ${q.learning.length} 張學習中的卡，約 ${formatInterval(later.due - Date.now())}後再出現。` : '今天的新卡和到期卡都做完了。'}</p>
        <p class="muted">這一輪複習了 ${session} 張。</p>
        <button class="cta" id="back">ホームへ</button>`;
      $('#back', root).addEventListener('click', () => go('home'));
      return;
    }
    const d = c.data;
    const sayWord = () => play(c.src.audio, d.audioKey, d.reading, 1);
    const sayLine = line => play(c.src.audio, line.audioKey, kanaText(line.ruby), S.settings.speed);
    let front = '';
    let back = '';
    let autoplay = null;
    const exampleBox = ex => ex ? `<div class="card flat"><div class="jp sm">${renderRuby(ex.ruby, 'furi')}</div><p class="muted">${esc(ex.zh)}</p></div>` : '';

    if (c.kind === 'sentence') {
      autoplay = () => sayLine(d);
      front = `<div style="text-align:center;margin-top:16px"><button class="play-main" data-play>${ICON.vol}</button></div>`;
      back = `<div class="jp" style="text-align:center">${renderRuby(d.ruby, 'furi')}</div><p class="muted" style="text-align:center">${esc(d.zh)}</p>
        <p class="muted" style="text-align:center">${esc(speakerName(S.cast, d.speaker))}・${esc(c.src.title)}</p>`;
    } else if (c.kind === 'vocab-listen' || c.kind === 'vocab-read') {
      const listen = c.kind === 'vocab-listen';
      autoplay = listen ? sayWord : null;
      front = listen ? `<div style="text-align:center;margin-top:16px"><button class="play-main" data-play>${ICON.vol}</button></div>`
        : `<div class="big-word" style="margin-top:20px">${esc(d.text)}</div>`;
      back = `<div style="text-align:center">${listen ? `<div class="muted">${esc(d.reading)}</div><div class="big-word">${esc(d.text)}</div>` : `<div style="font-size:22px;color:var(--brand)">${esc(d.reading)}</div>`}
        <div class="muted">${esc(d.pos)}・${c.level}</div><p style="font-size:18px;margin-top:6px">${esc(d.zh)}</p></div>
        ${exampleBox(d.example)}${d.example ? `<button class="ghost" data-ex>${ICON.vol} 例文を聴く</button>` : ''}`;
    } else if (c.kind === 'phrase-cloze') {
      const parts = clozeParts(d.line.text, d.surface) || [d.line.text, '', ''];
      autoplay = () => sayLine(d.line);
      front = `<button class="play-main" data-play style="align-self:center">${ICON.vol}</button>
        <div class="jp" style="text-align:center">${esc(parts[0])}<span class="cloze">？</span>${esc(parts[2])}</div>`;
      back = `<div class="jp" style="text-align:center">${esc(parts[0])}<span class="cloze">${esc(parts[1])}</span>${esc(parts[2])}</div>
        <div class="card flat"><p><b>${esc(d.text)}</b></p><p>${esc(d.zh)}</p><p class="muted">出典：${esc(c.src.title)}</p></div>`;
    } else if (c.kind === 'grammar') {
      const ex = d.line || d.examples[0];
      autoplay = () => sayLine(ex);
      front = `<button class="play-main" data-play style="align-self:center">${ICON.vol}</button>
        <div class="jp" style="text-align:center">${renderRuby(ex.ruby, 'furi', [d.surface])}</div>`;
      back = `<p class="muted" style="text-align:center">${esc(ex.zh)}</p>
        <div class="card flat stack" style="gap:6px"><span class="chip brand" style="align-self:flex-start">${esc(d.pattern)}</span><p>${esc(d.zh)}</p>
        ${d.examples.map((e, i) => `<button class="gex" data-gex="${i}"><span class="jp sm">${renderRuby(e.ruby, 'furi')}</span><span class="muted">${ICON.vol.replace('aria-hidden="true"', 'aria-hidden="true" width="14" height="14"')} ${esc(e.zh)}</span></button>`).join('')}</div>`;
    }
    const iv = preview(c, Date.now(), S.settings.retention).map(formatInterval);
    root.innerHTML = `
      <div class="row between"><button class="icon-btn" id="close" aria-label="閉じる">${ICON.close}</button>
        <span class="muted num">残り ${left}</span>
        <button class="icon-btn" id="more" aria-label="このカードを停止">${ICON.flag}</button></div>
      <div class="card flash">
        <div class="row between"><span class="chip ${c.deck === 'grammar' ? 'brand' : ''}">${DECK_NAMES[c.deck]}</span><span class="muted">${c.state === 'new' ? '新しいカード' : c.flagged ? '要注意' : ''}</span></div>
        <p class="muted">${KIND_HINT[c.kind]}</p>
        ${front}
        <div id="backSide" class="stack" hidden>${back}</div>
      </div>
      <button class="cta" id="show">答えを見る</button>
      <div class="rates" id="rates" hidden>${RATES.map(([r, cls], k) => `<button class="${cls}" data-r="${k + 1}">${r}<small>${iv[k]}</small></button>`).join('')}</div>`;
    $('#close', root).addEventListener('click', () => { stop(); overview(); });
    $('#more', root).addEventListener('click', async () => {
      await updateCard({ ...c, suspended: true });
      toast('這張卡已暫停，可在「カード一覧」恢復。');
      show();
    });
    $$('[data-play]', root).forEach(b => b.addEventListener('click', () => autoplay && autoplay()));
    $('[data-ex]', root)?.addEventListener('click', () => sayLine(d.example));
    $$('[data-gex]', root).forEach(b => b.addEventListener('click', () => sayLine(d.examples[+b.dataset.gex])));
    if (autoplay) setTimeout(() => autoplay(), 200);
    $('#show', root).addEventListener('click', () => {
      $('#backSide', root).hidden = false;
      $('#show', root).hidden = true;
      $('#rates', root).hidden = false;
      if (c.kind === 'vocab-read') sayWord();
    });
    $$('[data-r]', root).forEach(b => b.addEventListener('click', async () => {
      await rate(c, +b.dataset.r);
      session++;
      show();
    }));
  }

  function browse() {
    root.innerHTML = `
      <div class="row between"><button class="icon-btn" id="back" aria-label="戻る">${ICON.close}</button><h1>カード一覧</h1><span></span></div>
      <input type="search" id="q" placeholder="終電、温める、〜てください" style="min-height:44px;border-radius:12px;border:1px solid var(--line);background:var(--surface);padding:0 12px">
      <div class="seg" role="group" aria-label="デッキ">${['all', ...DECKS, 'suspended'].map(d => `<button data-deck="${d}" aria-pressed="${d === 'all'}">${d === 'all' ? 'すべて' : d === 'suspended' ? '停止中' : DECK_NAMES[d].replace('（聴き取り）', '')}</button>`).join('')}</div>
      <div class="card" id="list" style="padding-block:4px"></div>`;
    let deck = 'all';
    const title = c => esc(c.data.text || c.data.pattern || '');
    const status = c => c.suspended ? '<span class="chip warn">停止中</span>' : c.state === 'new' ? '<span class="chip">新</span>'
      : c.state === 'review' ? `<span class="chip good">${formatInterval(c.due - Date.now())}後</span>` : '<span class="chip brand">学習中</span>';
    function draw() {
      const term = $('#q', root).value.trim();
      const rows = S.cards.filter(c => (deck === 'all' || (deck === 'suspended' ? c.suspended : c.deck === deck))
        && (!term || JSON.stringify(c.data).includes(term))).slice(0, 200);
      $('#list', root).innerHTML = rows.length ? rows.map(c => `
        <div class="check"><span style="flex:1;min-width:0"><b>${title(c)}</b><br><span class="muted">${DECK_NAMES[c.deck]}・${c.kind.replace('vocab-', '')}・${c.level}${c.lapses ? `・忘れ ${c.lapses}` : ''}</span></span>
        ${status(c)}<button class="ghost" data-toggle="${esc(c.id)}">${c.suspended ? '再開' : '停止'}</button></div>`).join('')
        : '<p class="muted empty">該当するカードはありません。</p>';
      $$('[data-toggle]', root).forEach(b => b.addEventListener('click', async () => {
        const c = S.cards.find(x => x.id === b.dataset.toggle);
        await updateCard({ ...c, suspended: !c.suspended });
        draw();
      }));
    }
    $('#back', root).addEventListener('click', () => go('review'));
    $('#q', root).addEventListener('input', draw);
    $$('[data-deck]', root).forEach(b => b.addEventListener('click', () => {
      deck = b.dataset.deck;
      $$('[data-deck]', root).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      draw();
    }));
    draw();
  }
}
