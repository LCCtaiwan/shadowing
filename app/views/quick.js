// 零碎時間：單字快練（聽 → 跟念 → 看意思，可錄音比對）與發音聽辨（長音、促音、濁音…二選一）。
import { S, rate, loadEpisode, saveProgress, markPracticed, todayStr } from '../state.js';
import { $, $$, ICON, esc, toast, ring, animateRing } from '../ui.js';
import { renderRuby } from '../lib/ruby.js';
import { play, stop, wait } from '../lib/audio.js';
import { endOfDay } from '../lib/srs.js';
import { nextUnfinished } from '../lib/schedule.js';
import { buildNetwork, renderNetwork, learnedWords } from '../lib/network.js';
import { go } from '../main.js';

const SESSION = 10;

export default async function quick(root, [mode]) {
  document.body.classList.add('focus');
  if (mode === 'pron') await pron(root);
  else await vocab(root);
  return () => { stop(); stopRecording(); document.body.classList.remove('focus'); };
}

/* ---------- 錄音比對 ---------- */
let recorder = null;
let stream = null;
function stopRecording() {
  try { recorder?.state === 'recording' && recorder.stop(); } catch { /* ignore */ }
  stream?.getTracks().forEach(t => t.stop());
  stream = null;
}
async function recordClip(ms = 2500) {
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const chunks = [];
  recorder = new MediaRecorder(stream);
  recorder.ondataavailable = e => e.data.size && chunks.push(e.data);
  const done = new Promise(r => { recorder.onstop = r; });
  recorder.start();
  await wait(ms);
  stopRecording();
  await done;
  return URL.createObjectURL(new Blob(chunks, { type: recorder.mimeType || 'audio/mp4' }));
}
const canRecord = () => Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

/* ---------- 單字快練 ---------- */
async function pickWords() {
  const eod = endOfDay(Date.now());
  const cards = S.cards.filter(c => c.kind === 'vocab-listen' && !c.suspended && c.state !== 'new');
  const due = cards.filter(c => c.due < eod).sort((a, b) => a.due - b.due);
  const rest = cards.filter(c => c.due >= eod).sort((a, b) => a.s - b.s);
  const picked = [...due, ...rest].slice(0, SESSION).map(c => ({ card: c, ...c.data, audio: c.src.audio, rated: c.due < eod }));
  if (picked.length >= 5) return { words: picked, preview: false };
  // 還沒有學過的單字：用下一話（家族旅行優先）的單字預習，不計入複習
  const series = ['family', 'anime', 'drama'];
  for (const sr of series) {
    const meta = nextUnfinished(S.index.episodes.filter(e => e.series === sr), todayStr(), S.progress.episodes);
    if (!meta) continue;
    const ep = await loadEpisode(meta);
    const lines = Object.fromEntries(ep.scenes.flatMap(sc => sc.lines.map(l => [l.id, l])));
    const preview = ep.vocab.filter(v => !v.review).slice(0, SESSION - picked.length).map(v => ({
      card: null, text: v.text, reading: v.reading, pos: v.pos, zh: v.zh, audioKey: v.id, audio: meta.audio, rated: false,
      example: lines[v.line] && { text: lines[v.line].text, ruby: lines[v.line].ruby, zh: lines[v.line].zh, audioKey: v.line },
    }));
    return { words: [...picked, ...preview], preview: true, from: meta };
  }
  return { words: picked, preview: false };
}

async function vocab(root) {
  const { words, preview, from } = await pickWords();
  if (!words.length) {
    root.innerHTML = `<div class="card empty stack"><h2>還沒有單字</h2><p class="muted">先練一話，單字就會出現在這裡。</p><button class="cta" id="back">回首頁</button></div>`;
    $('#back', root).addEventListener('click', () => go('home'));
    return;
  }
  let i = 0;
  let remembered = 0;
  const show = () => {
    stop();
    const w = words[i];
    if (!w) return finish();
    root.innerHTML = `
      <div class="row between"><button class="icon-btn" id="close" aria-label="關閉">${ICON.close}</button>
        <span class="muted num">單字快練 ${i + 1} / ${words.length}</span><span style="width:44px"></span></div>
      <div class="bar"><i style="width:${(i / words.length) * 100}%"></i></div>
      ${preview && i === 0 ? `<p class="muted">還沒有學過的單字，先預習下一話《${esc(from.title)}》的單字（不計入複習）。</p>` : ''}
      <div class="card flash" style="align-items:center;justify-content:center">
        <div aria-live="polite">${ring('qRing', '<span id="qState" style="font-size:16px">先聽</span>')}</div>
        <div id="answer" class="stack" style="align-items:center;text-align:center" hidden>
          <div class="muted">${esc(w.reading)}</div><div class="big-word">${esc(w.text)}</div>
          <div class="muted">${esc(w.pos || '')}</div><p style="font-size:18px">${esc(w.zh)}</p>
          ${w.example ? `<div class="card flat" style="text-align:left;width:100%"><div class="jp sm">${renderRuby(w.example.ruby, 'furi')}</div><p class="muted">${esc(w.example.zh)}</p></div>` : ''}
          <div style="width:100%">${renderNetwork(buildNetwork(w.card?.note || w.audioKey, S.lexicon, learnedWords(S.cards)))}</div>
        </div>
      </div>
      <div class="row wrap" style="justify-content:center">
        <button class="ghost" id="again">${ICON.vol} 再聽一次</button>
        ${canRecord() ? `<button class="ghost" id="rec">${ICON.mic} 錄音比對</button>` : ''}
      </div>
      <div class="rates" id="rates" style="grid-template-columns:1fr 1fr" hidden>
        <button class="again" data-r="1">不熟<small>${w.rated ? '等一下再出現' : '再練'}</small></button>
        <button class="goodr" data-r="3">記得<small>${w.rated ? '照排程' : '下一個'}</small></button>
      </div>`;
    $('#close', root).addEventListener('click', () => go('home'));
    const say = () => play(w.audio, w.audioKey, w.reading, 1);
    $('#again', root).addEventListener('click', say);
    $('#rec', root)?.addEventListener('click', async e => {
      const btn = e.currentTarget;
      try {
        btn.disabled = true;
        btn.innerHTML = `${ICON.mic} 錄音中…請念出來`;
        const url = await recordClip(Math.max(1800, w.reading.length * 450));
        btn.innerHTML = `${ICON.vol} 播放你的聲音…`;
        await new Promise(r => { const a = new Audio(url); a.onended = r; a.onerror = r; a.play().catch(r); });
        await wait(300);
        btn.innerHTML = `${ICON.vol} 原音`;
        await say();
      } catch {
        toast('沒辦法使用麥克風。請在手機設定允許這個網頁使用麥克風。');
      } finally {
        btn.disabled = false;
        btn.innerHTML = `${ICON.mic} 錄音比對`;
      }
    });
    $$('[data-r]', root).forEach(b => b.addEventListener('click', async () => {
      const g = +b.dataset.r;
      if (g === 3) remembered++;
      if (w.card && w.rated) await rate(w.card, g);
      if (g === 1 && !w.requeued) words.push({ ...w, requeued: true, rated: false });
      i++;
      show();
    }));
    (async () => {
      const r = await say();
      if (r.cancelled) return;
      $('#qState', root).textContent = '換你念';
      const ms = Math.max(1200, r.ms * 1.5);
      animateRing($('#qRing', root), ms);
      await wait(ms);
      if (words[i] !== w) return;
      $('#qState', root).textContent = '看答案';
      $('#answer', root).hidden = false;
      $('#rates', root).hidden = false;
    })();
  };
  async function finish() {
    await markPracticed();
    root.innerHTML = `<h1 class="ep-title">單字快練完成</h1>
      <div class="card stack"><div class="row between"><span>這一輪</span><b class="num">${words.length} 個</b></div>
      <div class="row between"><span>記得</span><b class="num">${remembered}</b></div></div>
      <button class="cta" id="more">再來一輪</button><button class="ghost" id="home">回首頁</button>`;
    $('#more', root).addEventListener('click', () => vocab(root));
    $('#home', root).addEventListener('click', () => go('home'));
  }
  show();
}

/* ---------- 發音聽辨 ---------- */
async function pron(root) {
  const sets = S.index.pron || [];
  if (!sets.length) {
    root.innerHTML = `<div class="card empty stack"><h2>發音題庫準備中</h2><button class="cta" id="back">回首頁</button></div>`;
    $('#back', root).addEventListener('click', () => go('home'));
    return;
  }
  S.progress.pron ||= {};
  const meta = [...sets].sort((a, b) => (S.progress.pron[a.id]?.total || 0) - (S.progress.pron[b.id]?.total || 0))[0];
  const data = await fetch(meta.path).then(r => r.json());
  const items = [...data.items].sort(() => Math.random() - 0.5).slice(0, SESSION)
    .map(it => ({ ...it, side: Math.random() < 0.5 ? 'a' : 'b' }));
  let i = 0;
  let correct = 0;
  const say = (it, side) => play(meta.audio, `${it.id}-${side}`, it[side].reading, 1);

  const show = () => {
    stop();
    const it = items[i];
    if (!it) return finish();
    root.innerHTML = `
      <div class="row between"><button class="icon-btn" id="close" aria-label="關閉">${ICON.close}</button>
        <span class="muted num">發音聽辨 ${i + 1} / ${items.length}</span><span style="width:44px"></span></div>
      <div class="bar"><i style="width:${(i / items.length) * 100}%"></i></div>
      ${i === 0 ? `<div class="card flat"><b>${esc(data.title_zh)}</b><p class="muted">${esc(data.tip_zh || '')}</p></div>` : ''}
      <div class="card stack" style="align-items:center">
        <button class="play-main" id="play" aria-label="再聽一次">${ICON.vol}</button>
        <p class="muted">聽到的是哪一個？<span class="chip">${esc(it.contrast)}</span></p>
      </div>
      <div class="pair">${['a', 'b'].map(s => `<button class="opt" data-s="${s}">${esc(it[s].reading)}<small>${esc(it[s].text)}</small></button>`).join('')}</div>
      <div class="card stack" id="why" hidden></div>
      <button class="cta" id="next" hidden>${i === items.length - 1 ? '看結果' : '下一題'}</button>`;
    $('#close', root).addEventListener('click', () => go('home'));
    $('#play', root).addEventListener('click', () => say(it, it.side));
    let answered = false;
    $$('[data-s]', root).forEach(b => b.addEventListener('click', () => {
      if (answered) return;
      answered = true;
      const ok = b.dataset.s === it.side;
      if (ok) correct++;
      $$('[data-s]', root).forEach(x => { x.classList.toggle('right', x.dataset.s === it.side); x.classList.toggle('wrong', x === b && !ok); });
      const why = $('#why', root);
      why.hidden = false;
      why.innerHTML = `<p style="font-weight:700">${ok ? '答對了' : '答錯了'}</p>
        ${['a', 'b'].map(s => `<button class="gex" data-hear="${s}"><span><b>${esc(it[s].reading)}</b>（${esc(it[s].text)}）${s === it.side ? '　← 剛才播的' : ''}</span><span class="muted">${ICON.vol.replace('aria-hidden="true"', 'aria-hidden="true" width="14" height="14"')} ${esc(it[s].zh)}</span></button>`).join('')}
        <p class="muted">${esc(it.note_zh || '')}</p>`;
      $$('[data-hear]', root).forEach(x => x.addEventListener('click', () => say(it, x.dataset.hear)));
      $('#next', root).hidden = false;
    }));
    $('#next', root).addEventListener('click', () => { i++; show(); });
    setTimeout(() => say(it, it.side), 250);
  };
  async function finish() {
    const p = S.progress.pron[meta.id] || { total: 0, correct: 0 };
    S.progress.pron[meta.id] = { total: p.total + items.length, correct: p.correct + correct, at: Date.now() };
    await saveProgress();
    await markPracticed();
    root.innerHTML = `<h1 class="ep-title">發音聽辨完成</h1>
      <div class="card stack"><div class="row between"><span>${esc(data.title_zh)}</span><b class="num">${correct} / ${items.length}</b></div></div>
      <button class="cta" id="more">再來一輪</button><button class="ghost" id="home">回首頁</button>`;
    $('#more', root).addEventListener('click', () => pron(root));
    $('#home', root).addEventListener('click', () => go('home'));
  }
  show();
}
