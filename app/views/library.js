// 課程頁：兩部劇的所有集數與聽力練習；到日期或輪到的才解鎖，做過的可以重練。
import { S, todayStr } from '../state.js';
import { isUnlocked } from '../lib/schedule.js';
import { $$, esc, toast, SERIES_NAME, SERIES_ZH, SERIES_ORDER, SERIES_LABEL, seriesChip } from '../ui.js';
import { go } from '../main.js';

let current = 'family';

export default function library(root) {
  const today = todayStr();
  function draw() {
    const eps = S.index.episodes.filter(e => e.series === current);
    const epsAll = S.index.episodes;
    const sameSeries = e => epsAll.filter(x => x.series === e.series);
    const status = e => S.progress.episodes[e.id]?.done ? '<span class="chip good">練過</span>'
      : isUnlocked(e, sameSeries(e), today, S.progress.episodes) ? '<span class="chip brand">可以練</span>' : `<span class="chip">${e.date.slice(5).replace('-', '/')} 開放</span>`;
    const drills = S.index.drills;
    const dStatus = d => S.progress.drills[d.id]?.done ? '<span class="chip good">做過</span>'
      : isUnlocked(d, drills, today, S.progress.drills) ? '<span class="chip brand">可以做</span>' : `<span class="chip">${d.date.slice(5).replace('-', '/')} 開放</span>`;
    root.innerHTML = `
      <h1>課程</h1>
      <div class="seg" role="group" aria-label="類型" style="align-self:flex-start;flex-wrap:wrap">
        ${SERIES_ORDER.map(sr => `<button data-series="${sr}" aria-pressed="${current === sr}">${SERIES_LABEL[sr]}</button>`).join('')}
        <button data-series="drill" aria-pressed="${current === 'drill'}">聽力</button>
        <button data-series="pron" aria-pressed="${current === 'pron'}">發音</button>
      </div>
      ${current === 'pron' ? `
        <div class="card stack"><p class="muted">發音聽辨每組 20 題，每輪隨機出 10 題。從首頁「零碎時間」開始會自動挑練得最少的一組。</p>
          <button class="cta" id="pronGo">開始發音聽辨</button></div>
        <div class="card" style="padding-block:4px">${(S.index.pron || []).map(p => `<div class="line"><div><div style="font-weight:700">${esc(p.title_zh)}</div><div class="muted">${esc(p.title)}・${p.items} 組</div></div>
          <div class="muted num">${S.progress.pron?.[p.id] ? `${S.progress.pron[p.id].correct}/${S.progress.pron[p.id].total}` : '未練'}</div></div>`).join('')}</div>`
      : current === 'drill' ? `
        <div class="card" style="padding-block:4px">${drills.map(d => `
          <button class="line" data-drill="${d.id}" ${isUnlocked(d, drills, today, S.progress.drills) ? '' : 'data-locked'}>
            <div><div class="muted num">第 ${d.week} 週・週${'一二三四五六日'[d.day - 1]}・${d.level}</div>
            <div style="font-weight:700">${d.kind === 'mock' ? '週末小模擬考' : '聽力練習'}　${d.items} 題</div></div><div>${dStatus(d)}</div></button>`).join('')}</div>`
      : `
        <div class="card">${seriesChip(current)}
          <h2 class="ep-title" style="font-size:22px;margin-top:6px">${SERIES_NAME[current]}</h2><p class="muted">${SERIES_ZH[current]}・目前 ${eps.length} 話（每週更新）</p></div>
        <div class="card" style="padding-block:4px">${eps.map(e => `
          <button class="line" data-ep="${e.id}" ${isUnlocked(e, sameSeries(e), today, S.progress.episodes) ? '' : 'data-locked'}>
            <div><div class="muted num">第 ${e.week} 週・第 ${e.episode} 話・${e.level}・${e.lines} 句</div>
            <div style="font-weight:700">${esc(e.title)}</div><div class="muted">${esc(e.title_zh)}</div></div><div>${status(e)}</div></button>`).join('')}</div>`}`;
    $$('[data-series]', root).forEach(b => b.addEventListener('click', () => { current = b.dataset.series; draw(); }));
    root.querySelector('#pronGo')?.addEventListener('click', () => go('quick/pron'));
    $$('[data-ep], [data-drill]', root).forEach(b => b.addEventListener('click', () => {
      const meta = b.dataset.ep ? S.index.episodes.find(e => e.id === b.dataset.ep) : S.index.drills.find(d => d.id === b.dataset.drill);
      if (b.hasAttribute('data-locked')) return toast(`${meta.date.replace(/-/g, '/')} 開放；或先把前面的練完。`);
      go(b.dataset.ep ? `ep/${meta.id}` : `drill/${meta.id}`);
    }));
  }
  draw();
}
