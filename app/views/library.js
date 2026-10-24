// ライブラリ：兩部劇的所有集數與ドリル，依日期解鎖；做過的可以重練。
import { S, todayStr } from '../state.js';
import { $, $$, esc, toast, SERIES_NAME } from '../ui.js';
import { go } from '../main.js';

const SERIES_ZH = { drama: '末班車之後・旅行日劇', anime: '放學後廣播社・動漫' };
let current = 'drama';

export default function library(root) {
  const today = todayStr();
  function draw() {
    const eps = S.index.episodes.filter(e => e.series === current);
    const status = e => S.progress.episodes[e.id]?.done ? '<span class="chip good">完了</span>'
      : e.date <= today ? '<span class="chip brand">開放中</span>' : `<span class="chip">${e.date.slice(5).replace('-', '/')}</span>`;
    const drills = S.index.drills;
    const dStatus = d => S.progress.drills[d.id]?.done ? '<span class="chip good">完了</span>'
      : d.date <= today ? '<span class="chip brand">開放中</span>' : `<span class="chip">${d.date.slice(5).replace('-', '/')}</span>`;
    root.innerHTML = `
      <h1>ライブラリ</h1>
      <div class="seg" role="group" aria-label="シリーズ" style="align-self:flex-start">
        <button data-series="drama" aria-pressed="${current === 'drama'}">日劇</button>
        <button data-series="anime" aria-pressed="${current === 'anime'}">動漫</button>
        <button data-series="drill" aria-pressed="${current === 'drill'}">ドリル</button>
      </div>
      ${current === 'drill' ? `
        <div class="card" style="padding-block:4px">${drills.map(d => `
          <button class="line" data-drill="${d.id}" ${d.date > today ? 'data-locked' : ''}>
            <div><div class="muted num">第${d.week}週・${d.kind === 'mock' ? '日曜' : `${'月火水木金土'[d.day - 1]}曜`}・${d.level}</div>
            <div style="font-weight:700">${d.kind === 'mock' ? 'ミニ模試' : '聴解ドリル'}　${d.items} 問</div></div><div>${dStatus(d)}</div></button>`).join('')}</div>`
      : `
        <div class="card"><span class="chip ${current === 'anime' ? 'anime' : 'brand'}">${current === 'anime' ? '動漫' : '日劇'}</span>
          <h2 class="ep-title" style="font-size:22px;margin-top:6px">${SERIES_NAME[current]}</h2><p class="muted">${SERIES_ZH[current]}・${eps.length} 話</p></div>
        <div class="card" style="padding-block:4px">${eps.map(e => `
          <button class="line" data-ep="${e.id}" ${e.date > today ? 'data-locked' : ''}>
            <div><div class="muted num">第${e.week}週 第${e.episode}話・${e.level}・${e.lines} 文</div>
            <div style="font-weight:700">${esc(e.title)}</div><div class="muted">${esc(e.title_zh)}</div></div><div>${status(e)}</div></button>`).join('')}</div>`}`;
    $$('[data-series]', root).forEach(b => b.addEventListener('click', () => { current = b.dataset.series; draw(); }));
    $$('[data-ep], [data-drill]', root).forEach(b => b.addEventListener('click', () => {
      const meta = b.dataset.ep ? S.index.episodes.find(e => e.id === b.dataset.ep) : S.index.drills.find(d => d.id === b.dataset.drill);
      if (b.hasAttribute('data-locked')) return toast(`${meta.date.replace(/-/g, '/')} に開放されます。`);
      go(b.dataset.ep ? `ep/${meta.id}` : `drill/${meta.id}`);
    }));
  }
  draw();
}
