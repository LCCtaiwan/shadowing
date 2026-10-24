// JLPT 形式の聴解ドリル：即時応答・課題理解・ポイント理解・発話表現。週日為小模擬（換算 60 分）。
import { S, loadDrill, finishDrill } from '../state.js';
import { $, $$, ICON, esc, toast, speakerName } from '../ui.js';
import { renderRuby, kanaText } from '../lib/ruby.js';
import { play, stop, wait, keepAwake, hasAudio, prefetch } from '../lib/audio.js';
import { nextUnfinished } from '../lib/schedule.js';
import { todayStr } from '../state.js';
import { go } from '../main.js';

export const TYPE_NAMES = { sokuji: '即時応答（聽一句選回應）', kadai: '課題理解（接下來做什麼）', point: 'ポイント理解（聽重點）', hatsuwa: '発話表現（這時要說什麼）', gaiyo: '概要理解（聽大意）', togo: '統合理解（整合資訊）' };
const TYPE_HINT = {
  sokuji: '聽一句話，再聽三個回應，選最自然的回應。跟 JLPT 一樣，選項只用聽的；答完才會顯示文字。',
  kadai: '先聽題目，再聽對話，選「接下來要做什麼」。選項有印出來。',
  point: '先聽題目，再聽對話，選理由或細節。選項有印出來。',
  hatsuwa: '看情境說明，聽三個說法，選這時該說的話。選項只用聽的。',
};

export default async function drill(root, [id]) {
  const meta = id ? S.index.drills.find(d => d.id === id) : nextUnfinished(S.index.drills, todayStr(), S.progress.drills);
  if (!meta) {
    root.innerHTML = `<h1>聽力練習</h1><div class="card empty stack"><p>目前的聽力練習都做完了。</p>
      <p class="muted">做過的可以在「課程」頁重做。</p><button class="cta" id="lib">去課程頁</button></div>`;
    $('#lib', root).addEventListener('click', () => go('lib'));
    return;
  }
  const data = await loadDrill(meta);
  const results = {};
  let i = 0;
  hasAudio(meta.audio, `${data.items[0].id}-s1`).then(ok => {
    if (!ok) toast('這份練習還沒配好 Gemini 音檔，先用系統語音代替。');
    else prefetch(meta.audio);
  });

  const say = (key, ruby) => play(meta.audio, key, kanaText(ruby), 1);

  function item() {
    stop();
    const it = data.items[i];
    if (!it) return finish();
    const audioOnly = it.type === 'sokuji' || it.type === 'hatsuwa';
    root.innerHTML = `
      <div class="row between"><button class="icon-btn" id="close" aria-label="關閉">${ICON.close}</button>
        <span class="chip brand">${TYPE_NAMES[it.type]}</span><span class="muted num">第 ${i + 1} / ${data.items.length} 題</span></div>
      <div class="bar"><i style="width:${(i / data.items.length) * 100}%"></i></div>
      <p class="muted">${TYPE_HINT[it.type] || ''}</p>
      ${it.situation_zh ? `<div class="card flat">${esc(it.situation_zh)}</div>` : ''}
      ${it.question ? `<div class="card"><p class="muted">題目</p><p class="jp sm">${renderRuby(it.question.ruby, S.settings.ruby === 'hide' ? 'furi' : S.settings.ruby)}</p></div>` : ''}
      <div class="card stack" style="align-items:center">
        <button class="play-main" id="play" aria-label="播放題目">${ICON.vol}</button>
        <p class="muted" id="state">按喇叭開始播放</p>
      </div>
      <div class="stack" style="gap:8px">${it.options.map((o, k) => `
        <div class="row">${audioOnly ? `<button class="icon-btn outlined" data-say="${k}" aria-label="聽選項 ${k + 1}">${ICON.vol}</button>` : ''}
          <button class="opt" data-i="${k}"><span class="num" style="font-weight:700">${k + 1}</span>
            <span class="opt-text" ${audioOnly ? 'hidden' : ''}>${renderRuby(o.ruby, 'furi')}</span></button></div>`).join('')}</div>
      <div class="card stack" id="why" hidden></div>
      <button class="cta" id="next" hidden>${i === data.items.length - 1 ? '看結果' : '下一題'}</button>`;

    let playing = false;
    async function playAll() {
      if (playing) { stop(); playing = false; $('#state', root).textContent = '已暫停'; return; }
      playing = true;
      keepAwake(true);
      const st = $('#state', root);
      const seq = [];
      if (it.setup) seq.push([`${it.id}-setup`, it.setup.ruby, '題目']);
      it.script.forEach((l, j) => seq.push([`${it.id}-s${j + 1}`, l.ruby, '對話']));
      if (it.question) seq.push([`${it.id}-question`, it.question.ruby, '題目']);
      if (audioOnly) it.options.forEach((o, k) => seq.push([`${it.id}-o${k + 1}`, o.ruby, `選項 ${k + 1}`]));
      for (const [key, ruby, label] of seq) {
        st.textContent = `播放${label}中…`;
        const r = await say(key, ruby);
        if (r.cancelled || !playing) return;
        await wait(label.startsWith('選項') ? 700 : 400);
      }
      playing = false;
      st.textContent = '播完了，選一個答案（想再聽就按喇叭）';
    }
    $('#play', root).addEventListener('click', playAll);
    $('#close', root).addEventListener('click', () => go('home'));
    $$('[data-say]', root).forEach(b => b.addEventListener('click', () => say(`${it.id}-o${+b.dataset.say + 1}`, it.options[+b.dataset.say].ruby)));
    $$('.opt', root).forEach(b => b.addEventListener('click', () => {
      if (results[it.id]) return;
      stop();
      playing = false;
      const k = +b.dataset.i;
      results[it.id] = { type: it.type, correct: k === it.answer };
      $$('.opt', root).forEach((x, j) => {
        x.classList.toggle('right', j === it.answer);
        x.classList.toggle('wrong', j === k && k !== it.answer);
        $('.opt-text', x).hidden = false;
      });
      const why = $('#why', root);
      why.hidden = false;
      why.innerHTML = `<p style="font-weight:700">${k === it.answer ? '答對了' : '答錯了'}</p>
        ${it.script.map(l => `<div><span class="spk">${esc(speakerName(S.cast, l.speaker))}</span><div class="jp sm">${renderRuby(l.ruby, 'furi')}</div><p class="muted">${esc(l.zh)}</p></div>`).join('')}
        <p class="muted">${esc(it.explain_zh)}</p>`;
      $('#next', root).hidden = false;
    }));
    $('#next', root).addEventListener('click', () => { i++; item(); window.scrollTo(0, 0); });
    setTimeout(playAll, 300);
  }

  async function finish() {
    stop();
    keepAwake(false);
    const vals = Object.values(results);
    const correct = vals.filter(r => r.correct).length;
    await finishDrill(meta, results);
    const byType = {};
    for (const r of vals) {
      byType[r.type] ||= [0, 0];
      byType[r.type][1]++;
      if (r.correct) byType[r.type][0]++;
    }
    const score60 = Math.round(correct / Math.max(1, vals.length) * 60);
    root.innerHTML = `
      <h1 class="ep-title">${meta.kind === 'mock' ? '小模擬考結果' : '練習完成'}</h1>
      <div class="card stack">
        <div class="row between"><span>答對</span><b class="num">${correct} / ${vals.length}</b></div>
        ${meta.kind === 'mock' ? `<div class="row between"><span>換算成 JLPT 聽解分數</span><b class="num">${score60} / 60</b></div>
          <div class="score" role="img" aria-label="${score60} 分，最低分 19 分"><i style="width:${score60 / 60 * 100}%"></i><u style="left:${19 / 60 * 100}%"></u></div>
          <p class="muted">紅線 = JLPT 各節最低 19 分（只是參考，題數和真題不同）。</p>` : ''}
      </div>
      <div class="card stack">${Object.entries(byType).map(([t, [c, n]]) => `<div class="row between"><span>${TYPE_NAMES[t]}</span><span class="num">${c} / ${n}</span></div>`).join('')}</div>
      <button class="cta" id="home">回首頁</button>`;
    $('#home', root).addEventListener('click', () => go('home'));
  }

  item();
  return () => stop();
}
