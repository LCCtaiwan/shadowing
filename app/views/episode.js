// 一話的五步：ブラインド聴き → 意味を理解 → 見てシャドー → ブラインドシャドー → カードに追加。
import { S, loadEpisode, saveResume, finishEpisode, setDifficulty, saveSettings } from '../state.js';
import { $, $$, ICON, esc, toast, seriesChip, wave, ring, animateRing, speakerName, SERIES_NAME } from '../ui.js';
import { renderRuby, kanaText } from '../lib/ruby.js';
import { play, stop, wait, keepAwake, mediaSession, prefetch, hasAudio } from '../lib/audio.js';
import { cardsFromEpisode, DECK_NAMES } from '../lib/cards.js';
import { go } from '../main.js';

const STEP_NAMES = ['1 ブラインド聴き', '2 意味を理解', '3 見てシャドー', '4 ブラインドシャドー', '5 カードに追加'];

export default async function episode(root, [id]) {
  const meta = S.index.episodes.find(e => e.id === id);
  if (!meta) { go('lib'); return; }
  const ep = await loadEpisode(meta);
  const lines = ep.scenes.flatMap(sc => sc.lines.map(l => ({ ...l, scene: sc })));
  const resume = S.progress.resume[id];
  const st = { step: resume?.step ?? 0, idx: resume?.lineIdx ?? 0, running: false };
  const isMe = sp => sp === 'yuxiang' || sp === 'xiaoyu';
  const say = l => play(meta.audio, l.id, kanaText(l.ruby), S.settings.speed);
  document.body.classList.add('focus');

  hasAudio(meta.audio, lines[0].id).then(ok => {
    if (!ok) toast('這一話還沒配好 Gemini 音檔，先用系統語音代替。');
    else prefetch(meta.audio);
  });

  root.innerHTML = `
    <div class="topbar">
      <button class="icon-btn" id="close" aria-label="閉じる">${ICON.close}</button>
      <div class="steps" id="steps">${STEP_NAMES.map(() => '<span></span>').join('')}</div>
    </div>
    <div class="row between wrap">
      <span class="muted" id="stepName"></span>
      <div class="seg" role="group" aria-label="ふりがな">
        <button data-ruby="furi">漢字＋かな</button><button data-ruby="kana">かな</button><button data-ruby="hide">隠す</button>
      </div>
    </div>
    <div id="body" class="stack" style="gap:14px"></div>`;
  $('#close', root).addEventListener('click', () => go('home'));
  $$('[data-ruby]', root).forEach(b => b.addEventListener('click', () => {
    S.settings.ruby = b.dataset.ruby;
    saveSettings();
    renderStep(true);
  }));

  const rubyHtml = (l, mode = S.settings.ruby) => mode === 'hide'
    ? '<span class="muted" style="font-size:15px">（テキスト非表示 — 耳だけで）</span>'
    : renderRuby(l.ruby, mode, l.focus || []);

  function renderStep(keepAudio) {
    if (!keepAudio) { stop(); st.running = false; }
    $$('[data-ruby]', root).forEach(b => b.setAttribute('aria-pressed', String(b.dataset.ruby === S.settings.ruby)));
    $$('#steps span', root).forEach((s, i) => s.classList.toggle('on', i <= st.step));
    $('#stepName', root).textContent = STEP_NAMES[st.step];
    saveResume(id, st.step, st.idx);
    [stepBlind, stepUnderstand, stepShadow, stepShadow, stepCards][st.step]($('#body', root));
  }
  const nextStep = () => { st.step++; st.idx = 0; renderStep(); window.scrollTo(0, 0); };

  function stepBlind(body) {
    body.innerHTML = `
      <div class="row wrap" style="gap:6px">${seriesChip(ep.series)}<span class="chip">${SERIES_NAME[ep.series]}</span><span class="chip">第${ep.week}週 第${ep.episode}話</span><span class="chip good">${ep.level}</span></div>
      <h1 class="ep-title">${esc(ep.title)}</h1>
      <p class="muted">${esc(ep.title_zh)}</p>
      <div class="card stack" style="gap:6px"><p class="muted">前回まで</p><div class="jp sm">${rubyHtml(ep.recap)}</div>
        <button class="zh blur" data-zh><span>${esc(ep.recap.zh)}</span>${ICON.eye}</button></div>
      <div class="card stack" style="align-items:center">
        ${wave()}
        <button class="play-main" id="playAll" aria-label="全部聴く">${ICON.play}</button>
        <p class="muted">文字を見ないで、全体を聴いてみよう（${lines.length} 文）</p>
      </div>
      <div class="card stack"><p style="font-weight:700">聴く前に：${esc(ep.focus.title)}</p><p class="muted">${esc(ep.focus.zh)}</p></div>
      ${ep.questions.map((q, qi) => `
        <div class="card stack" style="gap:8px" data-q="${qi}">
          <p style="font-weight:700">Q${qi + 1}. ${esc(q.q)}</p>
          ${q.options.map((o, i) => `<button class="opt" data-i="${i}"><span class="num muted">${i + 1}</span>${esc(o)}</button>`).join('')}
          <p class="muted" data-fb hidden></p>
        </div>`).join('')}
      <button class="cta" id="next">次へ：意味を理解</button>`;
    bindZh(body);
    $('#playAll', body).addEventListener('click', async () => {
      if (st.running) { stop(); st.running = false; setPlayAll(false); return; }
      st.running = true;
      setPlayAll(true);
      keepAwake(true);
      for (const l of lines) {
        const r = await say(l);
        if (r.cancelled || !st.running) return;
        await wait(350);
      }
      st.running = false;
      setPlayAll(false);
    });
    function setPlayAll(on) {
      $('#playAll', body).innerHTML = on ? ICON.pause : ICON.play;
      $('.wave', body).classList.toggle('live', on);
    }
    $$('[data-q]', body).forEach(card => {
      const q = ep.questions[+card.dataset.q];
      $$('.opt', card).forEach(b => b.addEventListener('click', () => {
        const i = +b.dataset.i;
        $$('.opt', card).forEach((x, j) => { x.classList.toggle('right', j === q.answer); x.classList.toggle('wrong', j === i && i !== q.answer); });
        const fb = $('[data-fb]', card);
        fb.hidden = false;
        fb.textContent = `${i === q.answer ? '正解。' : 'もう一度聴いてみよう。'}${q.q_zh}`;
      }));
    });
    $('#next', body).addEventListener('click', nextStep);
  }

  function stepUnderstand(body) {
    let lastScene = null;
    const rows = lines.map((l, i) => {
      const head = l.scene !== lastScene ? `<p class="muted" style="margin-top:8px">${l.scene.kind === 'radio' ? '<span class="radio-tag">ラジオドラマ</span>　' : ''}${esc(l.scene.setting_zh || '')}</p>` : '';
      lastScene = l.scene;
      return `${head}<div class="line" data-line="${i}">
        <div style="min-width:0"><div class="spk ${isMe(l.speaker) ? 'me' : ''}">${esc(speakerName(S.cast, l.speaker))}</div>
          <div class="jp sm">${rubyHtml(l)}</div>
          <button class="zh blur" data-zh><span>${esc(l.zh)}</span>${ICON.eye}</button></div>
        <button class="icon-btn" data-say="${i}" aria-label="再生">${ICON.vol}</button></div>`;
    }).join('');
    body.innerHTML = `
      <p class="muted">一句一句看懂。點中文看翻譯，點喇叭重聽。<mark>底色</mark> = 本話重點。</p>
      <div class="card" style="padding-block:2px">${rows}</div>
      <div class="card stack"><h2>今回の文法</h2>${ep.grammar.map(g => `
        <div><span class="chip brand">${esc(g.pattern)}</span><p class="muted" style="margin-top:4px">${esc(g.zh)}</p></div>`).join('')}</div>
      <div class="card stack"><h2>フレーズ</h2>${ep.phrases.map(p => `<p><b>${esc(p.text)}</b>　<span class="muted">${esc(p.zh)}</span></p>`).join('')}</div>
      <details class="card"><summary style="font-weight:700;cursor:pointer">単語 ${ep.vocab.length}</summary>
        <div class="stack" style="margin-top:8px">${ep.vocab.map(v => `<p>${esc(v.text)}（${esc(v.reading)}）<span class="muted">　${esc(v.zh)}・${v.level}${v.review ? '・復習' : ''}</span></p>`).join('')}</div></details>
      <button class="cta" id="next">シャドーイングへ</button>`;
    bindZh(body);
    $$('[data-say]', body).forEach(b => b.addEventListener('click', async () => {
      const row = b.closest('.line');
      $$('.line.playing', body).forEach(x => x.classList.remove('playing'));
      row.classList.add('playing');
      await say(lines[+b.dataset.say]);
      row.classList.remove('playing');
    }));
    $('#next', body).addEventListener('click', nextStep);
  }

  function stepShadow(body) {
    const blind = st.step === 3;
    st.idx = Math.min(st.idx, lines.length - 1);
    const l = lines[st.idx];
    const last = st.idx === lines.length - 1;
    body.innerHTML = `
      <p class="muted num">${st.idx + 1} / ${lines.length} 文　・　各文 ${S.settings.repeats} 回${l.scene.kind === 'radio' ? '　・　<span class="radio-tag">ラジオドラマ</span>' : ''}</p>
      <div class="card stack" style="min-height:170px;gap:6px">
        <div class="spk ${isMe(l.speaker) ? 'me' : ''}">${esc(speakerName(S.cast, l.speaker))}</div>
        <div class="jp" id="shText">${blind ? '<span class="muted" style="font-size:15px">耳だけで追いかけよう</span>' : rubyHtml(l)}</div>
        ${blind ? '<button class="ghost" id="peek" style="align-self:flex-start">ちょっと見る</button>' : `<button class="zh blur" data-zh><span>${esc(l.zh)}</span>${ICON.eye}</button>`}
      </div>
      <div aria-live="polite">${ring('shRing', '<span id="shState" style="font-size:16px">準備OK</span><span class="muted num" id="shRound"></span>')}</div>
      <div class="player">
        <div class="seg" role="group" aria-label="速度">${[0.75, 0.9, 1].map(s => `<button data-speed="${s}" aria-pressed="${S.settings.speed === s}">${s}×</button>`).join('')}</div>
        <button class="icon-btn" id="prev" aria-label="前の文">${ICON.prev}</button>
        <button class="play-main" id="play" aria-label="再生">${st.running ? ICON.pause : ICON.play}</button>
        <button class="icon-btn" id="nextLine" aria-label="次の文">${ICON.next}</button>
      </div>
      ${last ? `<button class="cta" id="next">${blind ? 'カードへ' : 'ブラインドシャドーへ'}</button>` : '<button class="ghost" id="skip">このステップを終える</button>'}`;
    bindZh(body);
    $('#peek', body)?.addEventListener('click', e => { $('#shText', body).innerHTML = rubyHtml(l, S.settings.ruby === 'hide' ? 'furi' : S.settings.ruby); e.currentTarget.remove(); });
    $$('[data-speed]', body).forEach(b => b.addEventListener('click', async () => {
      S.settings.speed = +b.dataset.speed;
      $$('[data-speed]', body).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      await saveSettings();
    }));
    const moveTo = i => { stop(); st.running = false; st.idx = i; st.autoplay = true; renderStep(true); };
    $('#prev', body).addEventListener('click', () => st.idx > 0 && moveTo(st.idx - 1));
    $('#nextLine', body).addEventListener('click', () => st.idx < lines.length - 1 && moveTo(st.idx + 1));
    $('#play', body).addEventListener('click', () => {
      if (st.running) { stop(); st.running = false; $('#play', body).innerHTML = ICON.play; $('#shState', body).textContent = '一時停止'; animateRing($('#shRing', body), 0); }
      else run();
    });
    $('#next', body)?.addEventListener('click', nextStep);
    $('#skip', body)?.addEventListener('click', nextStep);
    mediaSession(ep.title, SERIES_NAME[ep.series], {
      play: () => !st.running && run(), pause: () => { stop(); st.running = false; },
      next: () => st.idx < lines.length - 1 && moveTo(st.idx + 1), prev: () => st.idx > 0 && moveTo(st.idx - 1),
    });

    async function run() {
      stop();
      st.running = true;
      const myRun = st.runId = (st.runId || 0) + 1;
      const alive = () => st.running && st.runId === myRun;
      keepAwake(true);
      const me = l;
      $('#play', body).innerHTML = ICON.pause;
      for (let round = 1; round <= S.settings.repeats; round++) {
        $('#shState', body).textContent = '聴いて';
        $('#shRound', body).textContent = `${round} / ${S.settings.repeats}`;
        animateRing($('#shRing', body), 0);
        const r = await say(me);
        if (r.cancelled || !alive()) return;
        const pause = Math.round(r.ms * S.settings.pauseFactor);
        $('#shState', body).textContent = 'あなたの番';
        animateRing($('#shRing', body), pause);
        await wait(pause);
        if (!alive() || lines[st.idx] !== me) return;
      }
      if (st.idx < lines.length - 1) {
        st.idx++;
        st.running = false;
        st.autoplay = true;
        renderStep(true);
      } else {
        st.running = false;
        $('#shState', body).textContent = 'おつかれ';
        $('#play', body).innerHTML = ICON.play;
        keepAwake(false);
      }
    }
    if (st.autoplay) { st.autoplay = false; run(); }
  }

  function stepCards(body) {
    const existing = new Set(S.cards.map(c => c.id));
    const cards = cardsFromEpisode(ep, meta).filter(c => !existing.has(c.id));
    const label = c => {
      if (c.kind === 'sentence') return esc(c.data.text);
      if (c.kind === 'vocab-listen') return `${esc(c.data.text)}（${esc(c.data.reading)}）${esc(c.data.zh)}<span class="muted">・聴いて意味</span>`;
      if (c.kind === 'vocab-read') return `${esc(c.data.text)}<span class="muted">・読み方</span>`;
      if (c.kind === 'phrase-cloze') return `${esc(c.data.text)}　<span class="muted">${esc(c.data.zh)}</span>`;
      return `${esc(c.data.pattern)}　<span class="muted">${esc(c.data.zh.slice(0, 24))}…</span>`;
    };
    const groups = ['grammar', 'phrase', 'vocab', 'sentence'].map(deck => [deck, cards.filter(c => c.deck === deck)]).filter(([, cs]) => cs.length);
    body.innerHTML = `
      <p class="muted">預設全收；不想記的取消勾選。新卡每天依上限慢慢出現（單字 ${S.settings.limits.new.vocab}、文 ${S.settings.limits.new.sentence}…）。</p>
      ${cards.length ? groups.map(([deck, cs]) => `
        <div class="card" style="padding-block:4px">
          <div class="row between" style="padding:8px 0"><h2>${DECK_NAMES[deck]}</h2><span class="muted num">${cs.length}</span></div>
          ${cs.map(c => `<label class="check"><input type="checkbox" data-card="${esc(c.id)}" checked><span style="min-width:0">${label(c)}</span></label>`).join('')}
        </div>`).join('') : '<div class="card empty muted">這一話的卡片都已經在牌組裡了。</div>'}
      <button class="cta" id="finish">デッキに追加して終わる</button>`;
    $('#finish', body).addEventListener('click', async () => {
      const chosen = new Set($$('input[data-card]:checked', body).map(i => i.dataset.card));
      const n = await finishEpisode(meta, ep, chosen, null);
      renderDone(body, n);
    });
  }

  function renderDone(body, n) {
    stop();
    keepAwake(false);
    $$('#steps span', root).forEach(s => s.classList.add('on'));
    $('#stepName', root).textContent = '完了';
    body.innerHTML = `
      <h1 class="ep-title">おつかれさま</h1>
      <div class="stats3">
        <div class="card"><b class="num">${lines.length}</b><span class="muted">文</span></div>
        <div class="card"><b class="num">${lines.length * S.settings.repeats * 2}</b><span class="muted">シャドー回数</span></div>
        <div class="card"><b class="num">${n}</b><span class="muted">新カード</span></div>
      </div>
      <div class="card stack">
        <p style="font-weight:700">今回の難しさは？</p>
        <div class="diff">${['簡単すぎ', 'ちょうどいい', '難しい'].map((d, i) => `<button data-d="${i}" aria-pressed="false">${d}</button>`).join('')}</div>
        <p class="muted">每週整理成回饋，Claude 寫下週劇本時參考。</p>
      </div>
      <button class="cta" id="home">ホームへ</button>`;
    $$('.diff button', body).forEach(b => b.addEventListener('click', async () => {
      $$('.diff button', body).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      await setDifficulty(id, ['easy', 'ok', 'hard'][+b.dataset.d]);
    }));
    $('#home', body).addEventListener('click', () => go('home'));
  }

  function bindZh(body) {
    $$('[data-zh]', body).forEach(b => b.addEventListener('click', () => b.classList.toggle('blur')));
  }

  if (S.progress.episodes[id]?.done && !resume) {
    st.step = 0;
    toast('這一話已完成，可以再練一次（卡片不會重複加入）。');
  }
  renderStep();
  return () => { stop(); st.running = false; document.body.classList.remove('focus'); };
}
