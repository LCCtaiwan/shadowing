// JLPT 單字篩選：一張張滑，「我會了」略過、「我要學」才進複習。依考試日建議每天篩幾個。
import { S, loadJlpt, screenWord, undoScreen, studyPlan, todayStr } from '../state.js';
import { $, $$, ICON, esc, toast } from '../ui.js';
import { renderRuby, kanaText } from '../lib/ruby.js';
import { play, stop } from '../lib/audio.js';
import { buildNetwork, renderNetwork, learnedWords } from '../lib/network.js';
import { dayKey } from '../lib/srs.js';
import { go } from '../main.js';

export default async function words(root, [levelArg]) {
  const levels = (S.index.jlpt || []).filter(l => l.ready);
  if (!levels.length) {
    root.innerHTML = `<h1>JLPT 單字</h1><div class="card empty stack"><p>單字庫準備中，完成後會出現在這裡。</p><button class="cta" id="back">回首頁</button></div>`;
    $('#back', root).addEventListener('click', () => go('home'));
    return;
  }
  const plan = studyPlan();
  const defaultLevel = levels.find(l => plan.levels.includes(l.level)) || levels[0];
  const meta = levels.find(l => l.level === levelArg) || defaultLevel;
  const list = await loadJlpt(meta);
  const today = todayStr();
  const doneToday = () => Object.values(S.screen).filter(x => dayKey(x.at) === today).length;
  const history = [];
  document.body.classList.add('focus');

  function stats() {
    let known = 0, learn = 0;
    for (const v of list) {
      const s = S.screen[v.id];
      if (s?.choice === 'known') known++;
      else if (s?.choice === 'learn') learn++;
    }
    return { known, learn, left: list.length - known - learn };
  }

  function next() {
    stop();
    const st = stats();
    const v = list.find(x => !S.screen[x.id]);
    const goal = S.settings.plan.autoDaily ? plan.daily : null;
    const head = `
      <div class="row between"><button class="icon-btn" id="close" aria-label="關閉">${ICON.close}</button>
        <div class="seg" role="group" aria-label="級別">${levels.map(l => `<button data-level="${l.level}" aria-pressed="${l === meta}">${l.level}</button>`).join('')}</div>
        <button class="icon-btn" id="undo" aria-label="上一個">${ICON.prev}</button></div>
      <div class="row between muted num"><span>${meta.level}：會了 ${st.known}・要學 ${st.learn}・剩 ${st.left}</span>
        <span>今天 ${doneToday()}${goal ? ` / ${goal}` : ''}</span></div>`;
    if (!v) {
      root.innerHTML = `${head}<div class="card empty stack"><h2>${meta.level} 全部篩選完了</h2><p class="muted">要學的 ${st.learn} 個已經放進複習，每天會依上限慢慢出現。</p><button class="cta" id="home">回首頁</button></div>`;
      bindHead();
      $('#home', root).addEventListener('click', () => go('home'));
      return;
    }
    root.innerHTML = `${head}
      <div class="card flash swipe" id="card" style="touch-action:pan-y">
        <div class="row between"><span class="chip">${esc(v.pos || '')}</span><span class="chip brand">${v.level}</span></div>
        <div style="text-align:center"><div class="muted" style="font-size:16px">${esc(v.reading)}</div>
          <div class="big-word">${esc(v.text)}</div>
          <p style="font-size:18px;margin-top:6px">${esc(v.zh)}</p></div>
        ${v.example ? `<button class="gex" id="ex"><span class="jp sm">${renderRuby(v.example.ruby, 'furi', [v.text])}</span><span class="muted">${ICON.vol.replace('aria-hidden="true"', 'aria-hidden="true" width="14" height="14"')} ${esc(v.example.zh)}</span></button>` : ''}
        <details><summary class="muted" style="cursor:pointer">看連結圖</summary>${renderNetwork(buildNetwork(v.id, { vocab: { ...S.lexicon.vocab, [v.id]: v } }, learnedWords(S.cards)))}</details>
      </div>
      <p class="muted" style="text-align:center">往左滑＝我會了，往右滑＝我要學</p>
      <div class="rates" style="grid-template-columns:1fr 1fr">
        <button id="known">我會了<small>不用背，直接跳過</small></button>
        <button class="goodr" id="learn">我要學<small>放進複習</small></button>
      </div>`;
    bindHead();
    const say = () => play(meta.audio, v.id, v.reading, 1);
    setTimeout(say, 150);
    $('#ex', root)?.addEventListener('click', () => play(meta.audio, `${v.id}#ex`, kanaText(v.example.ruby), S.settings.speed));
    const decide = async choice => {
      history.push(v);
      await screenWord(v, meta, choice);
      next();
    };
    $('#known', root).addEventListener('click', () => decide('known'));
    $('#learn', root).addEventListener('click', () => decide('learn'));
    swipe($('#card', root), dir => decide(dir < 0 ? 'known' : 'learn'));
  }

  function bindHead() {
    $('#close', root).addEventListener('click', () => go('home'));
    $$('[data-level]', root).forEach(b => b.addEventListener('click', () => go(`words/${b.dataset.level}`)));
    $('#undo', root).addEventListener('click', async () => {
      const v = history.pop();
      if (!v) return toast('沒有可以復原的');
      await undoScreen(v);
      next();
    });
  }

  next();
  return () => { stop(); document.body.classList.remove('focus'); };
}

function swipe(el, done) {
  let x0 = null, dx = 0;
  el.addEventListener('pointerdown', e => { if (e.target.closest('button, summary, details')) return; x0 = e.clientX; dx = 0; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', e => {
    if (x0 === null) return;
    dx = e.clientX - x0;
    el.style.transform = `translateX(${dx}px) rotate(${dx / 30}deg)`;
    el.style.background = dx < -40 ? 'var(--surface-2)' : dx > 40 ? 'var(--good-tint)' : '';
  });
  const end = () => {
    if (x0 === null) return;
    x0 = null;
    if (Math.abs(dx) > 90) done(Math.sign(dx));
    else { el.style.transform = ''; el.style.background = ''; }
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}
