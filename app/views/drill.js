// JLPT 形式の聴解ドリル：即時応答・課題理解・ポイント理解・発話表現。週日為小模擬（換算 60 分）。
import { S, loadDrill, finishDrill } from '../state.js';
import { $, $$, ICON, esc, toast, speakerName } from '../ui.js';
import { renderRuby, kanaText } from '../lib/ruby.js';
import { play, stop, wait, keepAwake, hasAudio, prefetch } from '../lib/audio.js';
import { nextUnfinished } from '../lib/schedule.js';
import { todayStr } from '../state.js';
import { go } from '../main.js';

export const TYPE_NAMES = { sokuji: '即時応答', kadai: '課題理解', point: 'ポイント理解', hatsuwa: '発話表現', gaiyo: '概要理解', togo: '統合理解' };
const TYPE_HINT = {
  sokuji: '文を聴いて、いちばんいい返事を選ぶ（選択肢も音声だけ）',
  kadai: '最初に質問を聴いてから会話を聴く。これから何をするか選ぶ',
  point: '最初に質問を聴いてから会話を聴く。理由や細かいところを選ぶ',
  hatsuwa: '場面に合う言い方を選ぶ（選択肢は音声だけ）',
};

export default async function drill(root, [id]) {
  const meta = id ? S.index.drills.find(d => d.id === id) : nextUnfinished(S.index.drills, todayStr(), S.progress.drills);
  if (!meta) {
    root.innerHTML = `<h1>聴解ドリル</h1><div class="card empty stack"><p>今天沒有待做的ドリル。</p>
      <p class="muted">做過的ドリル可以在「ライブラリ」重做。</p><button class="cta" id="lib">ライブラリへ</button></div>`;
    $('#lib', root).addEventListener('click', () => go('lib'));
    return;
  }
  const data = await loadDrill(meta);
  const results = {};
  let i = 0;
  hasAudio(meta.audio, `${data.items[0].id}-s1`).then(ok => {
    if (!ok) toast('這份ドリル還沒配好 Gemini 音檔，先用系統語音代替。');
    else prefetch(meta.audio);
  });

  const say = (key, ruby) => play(meta.audio, key, kanaText(ruby), 1);

  function item() {
    stop();
    const it = data.items[i];
    if (!it) return finish();
    const audioOnly = it.type === 'sokuji' || it.type === 'hatsuwa';
    root.innerHTML = `
      <div class="row between"><button class="icon-btn" id="close" aria-label="閉じる">${ICON.close}</button>
        <span class="chip brand">${TYPE_NAMES[it.type]}</span><span class="muted num">${i + 1} / ${data.items.length}</span></div>
      <div class="bar"><i style="width:${(i / data.items.length) * 100}%"></i></div>
      <p class="muted">${TYPE_HINT[it.type] || ''}</p>
      ${it.situation_zh ? `<div class="card flat">${esc(it.situation_zh)}</div>` : ''}
      ${it.question ? `<div class="card"><p class="muted">質問</p><p class="jp sm">${renderRuby(it.question.ruby, S.settings.ruby === 'hide' ? 'furi' : S.settings.ruby)}</p></div>` : ''}
      <div class="card stack" style="align-items:center">
        <button class="play-main" id="play" aria-label="問題を聴く">${ICON.vol}</button>
        <p class="muted" id="state">再生ボタンを押して始める</p>
      </div>
      <div class="stack" style="gap:8px">${it.options.map((o, k) => `
        <div class="row">${audioOnly ? `<button class="icon-btn outlined" data-say="${k}" aria-label="選択肢${k + 1}を聴く">${ICON.vol}</button>` : ''}
          <button class="opt" data-i="${k}"><span class="num" style="font-weight:700">${k + 1}</span>
            <span class="opt-text" ${audioOnly ? 'hidden' : ''}>${renderRuby(o.ruby, 'furi')}</span></button></div>`).join('')}</div>
      <div class="card stack" id="why" hidden></div>
      <button class="cta" id="next" hidden>${i === data.items.length - 1 ? '結果を見る' : '次の問題'}</button>`;

    let playing = false;
    async function playAll() {
      if (playing) { stop(); playing = false; $('#state', root).textContent = '一時停止'; return; }
      playing = true;
      keepAwake(true);
      const st = $('#state', root);
      const seq = [];
      if (it.setup) seq.push([`${it.id}-setup`, it.setup.ruby, '質問']);
      it.script.forEach((l, j) => seq.push([`${it.id}-s${j + 1}`, l.ruby, '会話']));
      if (it.question) seq.push([`${it.id}-question`, it.question.ruby, '質問']);
      if (audioOnly) it.options.forEach((o, k) => seq.push([`${it.id}-o${k + 1}`, o.ruby, `選択肢 ${k + 1}`]));
      for (const [key, ruby, label] of seq) {
        st.textContent = `${label}を再生中…`;
        const r = await say(key, ruby);
        if (r.cancelled || !playing) return;
        await wait(label.startsWith('選択肢') ? 700 : 400);
      }
      playing = false;
      st.textContent = 'もう一度聴くときは再生ボタン';
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
      why.innerHTML = `<p style="font-weight:700">${k === it.answer ? '正解' : '不正解'}</p>
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
      <h1 class="ep-title">${meta.kind === 'mock' ? 'ミニ模試　結果' : 'ドリル完了'}</h1>
      <div class="card stack">
        <div class="row between"><span>正答</span><b class="num">${correct} / ${vals.length}</b></div>
        ${meta.kind === 'mock' ? `<div class="row between"><span>聴解 換算</span><b class="num">${score60} / 60</b></div>
          <div class="score" role="img" aria-label="${score60} 分，最低分 19 分"><i style="width:${score60 / 60 * 100}%"></i><u style="left:${19 / 60 * 100}%"></u></div>
          <p class="muted">紅線 = JLPT 各節最低 19 分（只是參考，題數和真題不同）。</p>` : ''}
      </div>
      <div class="card stack">${Object.entries(byType).map(([t, [c, n]]) => `<div class="row between"><span>${TYPE_NAMES[t]}</span><span class="num">${c} / ${n}</span></div>`).join('')}</div>
      <button class="cta" id="home">ホームへ</button>`;
    $('#home', root).addEventListener('click', () => go('home'));
  }

  item();
  return () => stop();
}
