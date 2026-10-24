// 一話的五步：盲聽 → 看懂 → 看字跟讀 → 盲跟讀 → 收卡。
import { S, loadEpisode, saveResume, finishEpisode, setDifficulty, saveSettings } from '../state.js';
import { $, $$, ICON, esc, toast, seriesChip, wave, ring, animateRing, speakerName, SERIES_NAME } from '../ui.js';
import { renderRuby, kanaText } from '../lib/ruby.js';
import { play, stop, wait, keepAwake, mediaSession, prefetch, hasAudio } from '../lib/audio.js';
import { cardsFromEpisode, DECK_NAMES } from '../lib/cards.js';
import { go } from '../main.js';

const STEP_NAMES = ['步驟 1／5　盲聽：不看字聽一遍', '步驟 2／5　看懂：一句一句理解', '步驟 3／5　跟讀：看著字跟著念', '步驟 4／5　盲跟讀：不看字跟著念', '步驟 5／5　收卡：加入複習'];

export default async function episode(root, [id]) {
  const meta = S.index.episodes.find(e => e.id === id);
  if (!meta) { go('lib'); return; }
  const ep = await loadEpisode(meta);
  const lines = ep.scenes.flatMap(sc => sc.lines.map(l => ({ ...l, scene: sc })));
  const resume = S.progress.resume[id];
  const st = { step: resume?.step ?? 0, idx: resume?.lineIdx ?? 0, running: false };
  const isMe = sp => ['yuxiang', 'xiaoyu', 'jiahui'].includes(sp);
  const say = l => play(meta.audio, l.id, kanaText(l.ruby), S.settings.speed);
  document.body.classList.add('focus');

  hasAudio(meta.audio, lines[0].id).then(ok => {
    if (!ok) toast('這一話還沒配好 Gemini 音檔，先用系統語音代替。');
    else prefetch(meta.audio);
  });

  root.innerHTML = `
    <div class="topbar">
      <button class="icon-btn" id="close" aria-label="關閉">${ICON.close}</button>
      <div class="steps" id="steps">${STEP_NAMES.map(() => '<span></span>').join('')}</div>
    </div>
    <div class="row between wrap">
      <span class="muted" id="stepName"></span>
      <div class="seg" role="group" aria-label="假名顯示">
        <button data-ruby="furi">漢字＋假名</button><button data-ruby="kana">只看假名</button><button data-ruby="hide">隱藏</button>
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
    ? '<span class="muted" style="font-size:15px">（文字已隱藏，只用耳朵聽）</span>'
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
      <div class="card stack" style="gap:6px"><p class="muted">前情提要（點中文看翻譯）</p><div class="jp sm">${rubyHtml(ep.recap)}</div>
        <button class="zh blur" data-zh><span>${esc(ep.recap.zh)}</span>${ICON.eye}</button></div>
      <div class="card stack" style="align-items:center">
        ${wave()}
        <button class="play-main" id="playAll" aria-label="播放整集">${ICON.play}</button>
        <p class="muted">按播放，不看字把整集聽一遍（${lines.length} 句），聽完回答下面的問題。</p>
      </div>
      <div class="card stack"><p style="font-weight:700">聽之前先注意：${esc(ep.focus.title)}</p><p class="muted">${esc(ep.focus.zh)}</p></div>
      ${ep.questions.map((q, qi) => `
        <div class="card stack" style="gap:8px" data-q="${qi}">
          <p style="font-weight:700">Q${qi + 1}. ${esc(q.q)}</p>
          ${q.options.map((o, i) => `<button class="opt" data-i="${i}"><span class="num muted">${i + 1}</span>${esc(o)}</button>`).join('')}
          <p class="muted" data-fb hidden></p>
        </div>`).join('')}
      <button class="cta" id="next">下一步：一句一句看懂</button>`;
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
        fb.textContent = `${i === q.answer ? '答對了。' : '再聽一次看看。'}題目意思：${q.q_zh}`;
      }));
    });
    $('#next', body).addEventListener('click', nextStep);
  }

  function stepUnderstand(body) {
    let lastScene = null;
    const rows = lines.map((l, i) => {
      const head = l.scene !== lastScene ? `<p class="muted" style="margin-top:8px">${l.scene.kind === 'radio' ? '<span class="radio-tag">廣播劇</span>　' : ''}${esc(l.scene.setting_zh || '')}</p>` : '';
      lastScene = l.scene;
      return `${head}<div class="line" data-line="${i}">
        <div style="min-width:0"><div class="spk ${isMe(l.speaker) ? 'me' : ''}">${esc(speakerName(S.cast, l.speaker))}</div>
          <div class="jp sm">${rubyHtml(l)}</div>
          <button class="zh blur" data-zh><span>${esc(l.zh)}</span>${ICON.eye}</button></div>
        <button class="icon-btn" data-say="${i}" aria-label="播放這句">${ICON.vol}</button></div>`;
    }).join('');
    body.innerHTML = `
      <p class="muted">一句一句看懂。點中文看翻譯，點喇叭重聽。<mark>底色</mark> = 本話重點。</p>
      <div class="card" style="padding-block:2px">${rows}</div>
      <div class="card stack"><h2>這一話的文法</h2>${ep.grammar.map(g => `
        <div><span class="chip brand">${esc(g.pattern)}</span><p class="muted" style="margin-top:4px">${esc(g.zh)}</p></div>`).join('')}</div>
      <div class="card stack"><h2>片語</h2>${ep.phrases.map(p => `<p><b>${esc(p.text)}</b>　<span class="muted">${esc(p.zh)}</span></p>`).join('')}</div>
      <details class="card"><summary style="font-weight:700;cursor:pointer">單字 ${ep.vocab.length} 個（點開）</summary>
        <div class="stack" style="margin-top:8px">${ep.vocab.map(v => `<p>${esc(v.text)}（${esc(v.reading)}）<span class="muted">　${esc(v.zh)}・${v.level}${v.review ? '・複習' : ''}</span></p>`).join('')}</div></details>
      <button class="cta" id="next">下一步：跟讀</button>`;
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
      <p class="muted num">第 ${st.idx + 1} / ${lines.length} 句・每句播 ${S.settings.repeats} 次，播完換你念${l.scene.kind === 'radio' ? '・<span class="radio-tag">廣播劇</span>' : ''}</p>
      <div class="card stack" style="min-height:170px;gap:6px">
        <div class="spk ${isMe(l.speaker) ? 'me' : ''}">${esc(speakerName(S.cast, l.speaker))}</div>
        <div class="jp" id="shText">${blind ? '<span class="muted" style="font-size:15px">不看字，只用耳朵跟著念</span>' : rubyHtml(l)}</div>
        ${blind ? '<button class="ghost" id="peek" style="align-self:flex-start">偷看一下</button>' : `<button class="zh blur" data-zh><span>${esc(l.zh)}</span>${ICON.eye}</button>`}
      </div>
      <div aria-live="polite">${ring('shRing', '<span id="shState" style="font-size:16px">按播放開始</span><span class="muted num" id="shRound"></span>')}</div>
      <div class="player">
        <div class="seg" role="group" aria-label="速度">${[0.75, 0.9, 1].map(s => `<button data-speed="${s}" aria-pressed="${S.settings.speed === s}">${s}×</button>`).join('')}</div>
        <button class="icon-btn" id="prev" aria-label="上一句">${ICON.prev}</button>
        <button class="play-main" id="play" aria-label="播放／暫停">${st.running ? ICON.pause : ICON.play}</button>
        <button class="icon-btn" id="nextLine" aria-label="下一句">${ICON.next}</button>
      </div>
      ${last ? `<button class="cta" id="next">${blind ? '下一步：收卡' : '下一步：不看字跟讀'}</button>` : '<button class="ghost" id="skip">跳過這一步</button>'}`;
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
      if (st.running) { stop(); st.running = false; $('#play', body).innerHTML = ICON.play; $('#shState', body).textContent = '已暫停'; animateRing($('#shRing', body), 0); }
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
        $('#shState', body).textContent = '先聽';
        $('#shRound', body).textContent = `${round} / ${S.settings.repeats}`;
        animateRing($('#shRing', body), 0);
        const r = await say(me);
        if (r.cancelled || !alive()) return;
        const pause = Math.round(r.ms * S.settings.pauseFactor);
        $('#shState', body).textContent = '換你念';
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
        $('#shState', body).textContent = '這一步完成';
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
      if (c.kind === 'vocab-listen') return `${esc(c.data.text)}（${esc(c.data.reading)}）${esc(c.data.zh)}<span class="muted">・聽音想意思</span>`;
      if (c.kind === 'vocab-read') return `${esc(c.data.text)}<span class="muted">・看字唸讀音</span>`;
      if (c.kind === 'vocab-link') return `${esc(c.data.text)}<span class="muted">・連結題（搭配）</span>`;
      if (c.kind === 'phrase-cloze') return `${esc(c.data.text)}　<span class="muted">${esc(c.data.zh)}</span>`;
      return `${esc(c.data.pattern)}　<span class="muted">${esc(c.data.zh.slice(0, 24))}…</span>`;
    };
    const groups = ['grammar', 'phrase', 'vocab', 'sentence'].map(deck => [deck, cards.filter(c => c.deck === deck)]).filter(([, cs]) => cs.length);
    body.innerHTML = `
      <p class="muted">這一話的單字、片語、文法、句子會加進複習。預設全收，不想記的取消勾選。新卡每天依上限慢慢出現（單字 ${S.settings.limits.new.vocab} 張、句子 ${S.settings.limits.new.sentence} 張…）。</p>
      ${cards.length ? groups.map(([deck, cs]) => `
        <div class="card" style="padding-block:4px">
          <div class="row between" style="padding:8px 0"><h2>${DECK_NAMES[deck]}</h2><span class="muted num">${cs.length}</span></div>
          ${cs.map(c => `<label class="check"><input type="checkbox" data-card="${esc(c.id)}" checked><span style="min-width:0">${label(c)}</span></label>`).join('')}
        </div>`).join('') : '<div class="card empty muted">這一話的卡片都已經在牌組裡了。</div>'}
      <button class="cta" id="finish">加入複習，完成這一話</button>`;
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
    $('#stepName', root).textContent = '完成';
    body.innerHTML = `
      <h1 class="ep-title">辛苦了</h1>
      <div class="stats3">
        <div class="card"><b class="num">${lines.length}</b><span class="muted">句</span></div>
        <div class="card"><b class="num">${lines.length * S.settings.repeats * 2}</b><span class="muted">跟讀次數</span></div>
        <div class="card"><b class="num">${n}</b><span class="muted">新卡片</span></div>
      </div>
      <div class="card stack">
        <p style="font-weight:700">這一話的難度？</p>
        <div class="diff">${['太簡單', '剛好', '太難'].map((d, i) => `<button data-d="${i}" aria-pressed="false">${d}</button>`).join('')}</div>
        <p class="muted">每週整理成回饋，Claude 寫下週劇本時參考。</p>
      </div>
      <button class="cta" id="home">回首頁</button>`;
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
    toast('這一話已經練過，可以再練一次（卡片不會重複加入）。');
  }
  renderStep();
  return () => { stop(); st.running = false; document.body.classList.remove('focus'); };
}
