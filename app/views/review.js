// Anki 式複習：牌組總覽 → 一張張卡片 → 四段評分（按鈕顯示下次間隔）。另有卡片一覽（搜尋、暫停）。
import { S, rate, updateCard, effectiveLimits } from '../state.js';
import { $, $$, ICON, esc, toast, speakerName } from '../ui.js';
import { renderRuby, kanaText } from '../lib/ruby.js';
import { play, stop } from '../lib/audio.js';
import { buildQueue, nextCard, deckCounts, estimateMinutes } from '../lib/srs.js';
import { preview, formatInterval } from '../lib/fsrs.js';
import { DECKS, DECK_NAMES, clozeParts } from '../lib/cards.js';
import { buildNetwork, renderNetwork, learnedWords, linkQuestion } from '../lib/network.js';
import { createPad } from '../lib/pad.js';
import { go } from '../main.js';

const LEVELS = [null, 'N5', 'N4', 'N3', 'N2'];
const RATES = [['重來', 'again'], ['困難', ''], ['良好', 'goodr'], ['簡單', '']];
const KIND_HINT = {
  sentence: '先聽，跟著念一次，想想意思，再看答案', 'vocab-listen': '聽發音，想想是什麼意思', 'vocab-read': '這個字怎麼唸？',
  'phrase-cloze': '聽整句，想想空格裡是什麼', grammar: '這個句型是什麼意思？', 'vocab-link': '哪一個能接在後面？自己想出搭配，記得最牢', 'vocab-write': '聽發音、看意思，把這個字寫在格子裡',
};

export default function review(root, [mode]) {
  let level = null;
  let session = 0;

  if (mode === 'browse') return browse();
  overview();

  function queue() { return buildQueue(S.cards, Date.now(), S.today, effectiveLimits(), level); }

  function overview() {
    const q = queue();
    const counts = deckCounts(q);
    const total = Object.values(counts).reduce((a, c) => a + c.new + c.learn + c.due, 0);
    root.innerHTML = `
      <div class="row between"><h1>複習</h1><button class="ghost" id="browse">所有卡片</button></div>
      ${S.cards.length ? `
      <div class="card" style="padding-block:4px">
        <div class="deck muted" style="font-size:12px"><span>牌組</span><b class="c-new">新卡</b><b class="c-learn">學習中</b><b class="c-due">到期</b></div>
        ${DECKS.map(d => `<div class="deck"><span>${DECK_NAMES[d]}</span><b class="c-new">${counts[d].new}</b><b class="c-learn">${counts[d].learn}</b><b class="c-due">${counts[d].due}</b></div>`).join('')}
      </div>
      <div class="row between muted"><span>目標記憶率 ${Math.round(S.settings.retention * 100)}%（FSRS 排程）</span><span>約 ${Math.max(total ? 1 : 0, estimateMinutes(counts))} 分鐘</span></div>
      <div class="seg" role="group" aria-label="只複習某一級">${LEVELS.map(l => `<button data-level="${l || ''}" aria-pressed="${l === level}">${l || '全部'}</button>`).join('')}</div>
      <button class="cta" id="start">${total ? '開始複習' : '今天的份做完了'}</button>
      <p class="muted">共 ${S.cards.length} 張卡・今天複習了 ${S.today.reviews} 張、學了新卡 ${Object.values(S.today.newByDeck).reduce((a, b) => a + b, 0)} 張</p>
      <p class="muted">怎麼複習：先聽或看題目，在心裡想答案，再按「看答案」。記不得按「重來」，想很久按「困難」，想得起來按「良好」，很輕鬆按「簡單」。按鈕下面的時間是下次再出現的時候。</p>`
      : `<div class="card empty stack"><h2>還沒有卡片</h2><p class="muted">練完一話的最後一步「收卡」，單字、片語、文法和句子就會進到這裡。</p><button class="cta" id="toHome">去練今天的一話</button></div>`}`;
    $('#browse', root).addEventListener('click', () => go('review/browse'));
    $('#toHome', root)?.addEventListener('click', () => go('home'));
    $$('[data-level]', root).forEach(b => b.addEventListener('click', () => { level = b.dataset.level || null; overview(); }));
    $('#start', root)?.addEventListener('click', () => (total ? show() : go('home')));
  }

  function show() {
    stop();
    const q = queue();
    const c = nextCard(q, Date.now(), S.today, effectiveLimits());
    const left = q.review.length + q.fresh.length + q.learning.filter(x => x.due <= Date.now() + 20 * 60e3).length;
    if (!c) {
      const later = q.learning[0];
      root.innerHTML = `<h1 class="ep-title">今天的複習完成了</h1>
        <p class="muted">${later ? `還有 ${q.learning.length} 張學習中的卡，約 ${formatInterval(later.due - Date.now())}後再出現。` : '今天的新卡和到期卡都做完了。'}</p>
        <p class="muted">這一輪複習了 ${session} 張。</p>
        <button class="cta" id="back">回首頁</button>`;
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
    const network = () => c.deck === 'vocab'
      ? renderNetwork(buildNetwork(c.note, S.lexicon, learnedWords(S.cards), d.example && { title: c.src.title, line: d.example })) : '';
    let quiz = null;

    if (c.kind === 'sentence') {
      autoplay = () => sayLine(d);
      front = `<div style="text-align:center;margin-top:16px"><button class="play-main" data-play>${ICON.vol}</button></div>`;
      back = `<div class="jp" style="text-align:center">${renderRuby(d.ruby, 'furi')}</div><p class="muted" style="text-align:center">${esc(d.zh)}</p>
        <p class="muted" style="text-align:center">${esc(speakerName(S.cast, d.speaker))}・出自《${esc(c.src.title)}》</p>`;
    } else if (c.kind === 'vocab-listen' || c.kind === 'vocab-read') {
      const listen = c.kind === 'vocab-listen';
      autoplay = listen ? sayWord : null;
      front = listen ? `<div style="text-align:center;margin-top:16px"><button class="play-main" data-play>${ICON.vol}</button></div>`
        : `<div class="big-word" style="margin-top:20px">${esc(d.text)}</div>`;
      back = `<div style="text-align:center">${listen ? `<div class="muted">${esc(d.reading)}</div><div class="big-word">${esc(d.text)}</div>` : `<div style="font-size:22px;color:var(--brand)">${esc(d.reading)}</div>`}
        <div class="muted">${esc(d.pos)}・${c.level}</div><p style="font-size:18px;margin-top:6px">${esc(d.zh)}</p></div>
        ${exampleBox(d.example)}${d.example ? `<button class="ghost" data-ex>${ICON.vol} 聽例句</button>` : ''}${network()}`;
    } else if (c.kind === 'vocab-write') {
      autoplay = sayWord;
      front = `<div style="text-align:center"><p style="font-size:20px">${esc(d.zh)}</p><p class="muted">${esc(d.pos || '')}・${[...d.text].length} 個字</p></div>
        <div class="tools">
          <button class="ghost" data-play>${ICON.vol} 再聽</button>
          <button class="ghost" id="hint">提示讀音</button>
          <button class="ghost" id="undoStroke">上一筆</button>
          <button class="ghost" id="clearPad">擦掉</button></div>
        <p class="muted" id="hintText" style="text-align:center" hidden>${esc(d.reading)}</p>
        <div id="padHost"></div>`;
      back = `<div style="text-align:center"><div class="muted">${esc(d.reading)}</div><div class="big-word">${esc(d.text)}</div>
        <p class="muted">淡色的字是正確字形，和你寫的比比看${/[\u3400-\u9fff]/.test(d.text) ? '；注意日本字形（新字體）和繁體可能不同' : ''}</p></div>
        ${exampleBox(d.example)}${network()}`;
    } else if (c.kind === 'vocab-link') {
      quiz = linkQuestion(c.note, S.lexicon, c.id);
      front = quiz
        ? `<div class="jp" style="text-align:center">${esc(quiz.cue)}<span class="cloze">？</span></div>
          <p class="muted" style="text-align:center">選項是辭書形，放進句子時可能會變化</p>
          <div class="stack" style="gap:8px">${quiz.options.map((o, i) => `<button class="opt" data-pick="${i}">${esc(o)}</button>`).join('')}</div>`
        : `<div class="big-word">${esc(d.text)}</div>`;
      back = `<div style="text-align:center"><div class="jp">${quiz ? `${esc(quiz.cue)}<span class="cloze">${esc(quiz.filled)}</span>` : esc(d.text)}</div>
        <p>${esc(quiz?.zh || d.zh)}</p><p class="muted">${esc(d.text)}（${esc(d.reading)}）${esc(d.zh)}</p></div>${network()}`;
    } else if (c.kind === 'phrase-cloze') {
      const parts = clozeParts(d.line.text, d.surface) || [d.line.text, '', ''];
      autoplay = () => sayLine(d.line);
      front = `<button class="play-main" data-play style="align-self:center">${ICON.vol}</button>
        <div class="jp" style="text-align:center">${esc(parts[0])}<span class="cloze">？</span>${esc(parts[2])}</div>`;
      back = `<div class="jp" style="text-align:center">${esc(parts[0])}<span class="cloze">${esc(parts[1])}</span>${esc(parts[2])}</div>
        <div class="card flat"><p><b>${esc(d.text)}</b></p><p>${esc(d.zh)}</p><p class="muted">出自《${esc(c.src.title)}》</p></div>`;
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
      <div class="row between"><button class="icon-btn" id="close" aria-label="關閉">${ICON.close}</button>
        <span class="muted num">還剩 ${left} 張</span>
        <button class="icon-btn" id="more" aria-label="暫停這張卡（不再出現）">${ICON.flag}</button></div>
      <div class="card flash">
        <div class="row between"><span class="chip ${c.deck === 'grammar' ? 'brand' : ''}">${DECK_NAMES[c.deck]}</span><span class="muted">${c.state === 'new' ? '新卡片' : c.flagged ? '常忘記的卡' : ''}</span></div>
        <p class="muted">${KIND_HINT[c.kind]}</p>
        ${front}
        <div id="backSide" class="stack" hidden>${back}</div>
      </div>
      <button class="cta" id="show">看答案</button>
      <div class="rates" id="rates" hidden>${RATES.map(([r, cls], k) => `<button class="${cls}" data-r="${k + 1}">${r}<small>${iv[k]}</small></button>`).join('')}</div>`;
    $('#close', root).addEventListener('click', () => { stop(); overview(); });
    $('#more', root).addEventListener('click', async () => {
      await updateCard({ ...c, suspended: true });
      toast('這張卡已暫停，可以在「所有卡片」恢復。');
      show();
    });
    $$('[data-play]', root).forEach(b => b.addEventListener('click', () => autoplay && autoplay()));
    let pad = null;
    if (c.kind === 'vocab-write') {
      pad = createPad($('#padHost', root), d.text);
      $('#hint', root).addEventListener('click', () => { $('#hintText', root).hidden = false; });
      $('#undoStroke', root).addEventListener('click', () => pad.undo());
      $('#clearPad', root).addEventListener('click', () => pad.clear());
    }
    $('[data-ex]', root)?.addEventListener('click', () => sayLine(d.example));
    $$('[data-gex]', root).forEach(b => b.addEventListener('click', () => sayLine(d.examples[+b.dataset.gex])));
    if (autoplay) setTimeout(() => autoplay(), 200);
    $$('[data-pick]', root).forEach(b => b.addEventListener('click', () => {
      if (!quiz || $('#backSide', root).hidden === false) return;
      const ok = quiz.options[+b.dataset.pick] === quiz.answer;
      $$('[data-pick]', root).forEach(x => {
        x.classList.toggle('right', quiz.options[+x.dataset.pick] === quiz.answer);
        x.classList.toggle('wrong', x === b && !ok);
      });
      $('#show', root).click();
      sayWord();
    }));
    $('#show', root).addEventListener('click', () => {
      $('#backSide', root).hidden = false;
      $('#show', root).hidden = true;
      $('#rates', root).hidden = false;
      pad?.reveal();
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
      <div class="row between"><button class="icon-btn" id="back" aria-label="返回">${ICON.close}</button><h1>所有卡片</h1><span></span></div>
      <input type="search" id="q" placeholder="終電、温める、〜てください" style="min-height:44px;border-radius:12px;border:1px solid var(--line);background:var(--surface);padding:0 12px">
      <div class="seg" role="group" aria-label="牌組" style="flex-wrap:wrap">${['all', ...DECKS, 'suspended'].map(d => `<button data-deck="${d}" aria-pressed="${d === 'all'}">${d === 'all' ? '全部' : d === 'suspended' ? '已暫停' : DECK_NAMES[d]}</button>`).join('')}</div>
      <div class="card" id="list" style="padding-block:4px"></div>`;
    let deck = 'all';
    const title = c => esc(c.data.text || c.data.pattern || '');
    const status = c => c.suspended ? '<span class="chip warn">已暫停</span>' : c.state === 'new' ? '<span class="chip">新卡</span>'
      : c.state === 'review' ? `<span class="chip good">${formatInterval(c.due - Date.now())}後</span>` : '<span class="chip brand">學習中</span>';
    function draw() {
      const term = $('#q', root).value.trim();
      const rows = S.cards.filter(c => (deck === 'all' || (deck === 'suspended' ? c.suspended : c.deck === deck))
        && (!term || JSON.stringify(c.data).includes(term))).slice(0, 200);
      $('#list', root).innerHTML = rows.length ? rows.map(c => `
        <div class="check"><span style="flex:1;min-width:0"><b>${title(c)}</b><br><span class="muted">${DECK_NAMES[c.deck]}・${{ sentence: '聽句子', 'vocab-listen': '聽音想意思', 'vocab-read': '看字唸讀音', 'vocab-link': '連結題', 'vocab-write': '手寫', 'phrase-cloze': '填空', grammar: '句型' }[c.kind]}・${c.level}${c.lapses ? `・忘了 ${c.lapses} 次` : ''}</span></span>
        ${status(c)}<button class="ghost" data-toggle="${esc(c.id)}">${c.suspended ? '恢復' : '暫停'}</button></div>`).join('')
        : '<p class="muted empty">沒有符合的卡片。</p>';
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
