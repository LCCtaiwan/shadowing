import { S, todayStr, toggleReading, saveSettings } from '../state.js';
import { ICON, esc, seriesChip, SERIES_ORDER } from '../ui.js';
import { todayTasks, daysUntil, streak, weekDots, nextUnfinished } from '../lib/schedule.js';
import { buildQueue, deckCounts, estimateMinutes, dayKey } from '../lib/srs.js';
import { go } from '../main.js';

const WD = '日一二三四五六';

const GUIDE = `
  <div class="card stack" id="guide">
    <h2>第一次使用：每天這樣練</h2>
    <ol class="guide">
      <li><b>照順序按下面的任務</b>：複習 → 新的一話（家族旅行、動漫、自助旅行三選一）→ 聽力練習 → 讀解。也可以直接按最下面的「繼續」。</li>
      <li><b>零碎時間</b>：排隊、等車時按「單字快練」或「發音聽辨」，1–3 分鐘就能練一輪。</li>
      <li><b>一話分 5 步</b>：① 不看字先聽一遍 ② 一句一句看懂 ③ 看著字跟著念 ④ 不看字跟著念 ⑤ 把單字、文法收進複習。</li>
      <li><b>跟讀時</b>：App 播完一句會停下來，圓圈倒數時換你念出來，念完自動播下一句。</li>
      <li><b>複習卡</b>：先聽或看題目，在心裡想答案，再按「看答案」，依記得的程度按「重來／困難／良好／簡單」。</li>
    </ol>
    <p class="muted">課表從 10/26 開始，每天解鎖一話；想先練也可以，下一話隨時能開始。</p>
    <button class="ghost" id="hideGuide">知道了</button>
  </div>`;

export default function home(root) {
  const today = todayStr();
  const t = todayTasks(S.index, S.progress, today);
  const q = buildQueue(S.cards, Date.now(), S.today, S.settings.limits);
  const counts = deckCounts(q);
  const reviewLeft = q.fresh.length + q.review.length + q.learning.filter(c => c.due < Date.now() + 864e5).length;
  const reviewMin = estimateMinutes(counts);
  const doneToday = (map, items) => items.filter(x => map[x.id] && dayKey(map[x.id].at) === today);
  const epDone = doneToday(S.progress.episodes, S.index.episodes);
  const drDone = doneToday(S.progress.drills, S.index.drills);
  const reviewedToday = (S.today.reviews || 0) + Object.values(S.today.newByDeck || {}).reduce((a, b) => a + b, 0);
  const epLabel = e => `第 ${e.episode} 話　${esc(e.title)}`;

  const tasks = [
    {
      k: 'review', icon: ICON.cards, done: reviewLeft === 0 && reviewedToday > 0, idle: reviewLeft === 0 && !reviewedToday,
      title: reviewLeft ? `複習 ${reviewLeft} 張卡` : (reviewedToday ? `複習 ${reviewedToday} 張 完成` : '複習（還沒有卡片）'),
      sub: reviewLeft ? `單字・文法・片語・句子　約 ${Math.max(1, reviewMin)} 分鐘` : (S.cards.length ? '今天的份做完了' : '做完一話的最後一步，卡片就會出現在這裡'),
      route: 'review',
    },
    (() => {
      const choices = SERIES_ORDER.map(sr => nextUnfinished(S.index.episodes.filter(e => e.series === sr), today, S.progress.episodes)).filter(Boolean);
      const done = epDone.length > 0;
      return {
        k: 'ep', icon: ICON.tv, done, idle: !done && !choices.length, choices,
        title: done ? `${epLabel(epDone.at(-1))} 完成` : choices.length ? '新的一話（三選一）' : '目前的話都練完了',
        sub: done ? (choices.length ? '有空可以再練一話：' : '今天的一話完成了') : choices.length ? '每天挑一部練一話，約 25 分鐘' : '下一週的劇本準備中',
        route: choices.length ? `ep/${choices[0].id}` : 'lib',
      };
    })(),
    drDone.length
      ? { k: 'drill', icon: ICON.head, done: true, title: '聽力練習 完成', sub: t.drill ? '還有下一份可以先做' : '結果在 JLPT 頁', route: t.drill ? `drill/${t.drill.id}` : 'jlpt' }
      : t.drill
        ? { k: 'drill', icon: ICON.head, done: false, title: t.drill.kind === 'mock' ? '週末小模擬考' : '聽力練習（JLPT 題型）',
          sub: `${t.drill.items} 題・約 ${t.drill.kind === 'mock' ? 20 : 15} 分鐘`, route: `drill/${t.drill.id}` }
        : { k: 'drill', icon: ICON.head, done: false, idle: true, title: '聽力練習都做完了', sub: '', route: 'lib' },
    { k: 'reading', icon: ICON.book, done: Boolean(S.reading[today]), title: '讀解（自己的教材）', sub: `${esc(S.settings.reading)}・約 30 分鐘・做完點一下打勾`, route: null },
  ];
  const nextTask = tasks.find(x => !x.done && !x.idle);
  const active = tasks.filter(x => !x.idle);
  const doneN = active.filter(x => x.done).length;
  const totalN = Math.max(1, active.length);
  const exam = S.index.exam_targets.find(e => e.date >= today);
  const now = new Date(`${today}T12:00:00`);
  const showGuide = !S.settings.guideSeen;

  root.innerHTML = `
    <div class="row between">
      <span class="muted">${now.getMonth() + 1}月${now.getDate()}日（週${WD[now.getDay()]}）</span>
      <div class="row" style="gap:6px">
        ${exam ? `<span class="chip brand num">距離 ${exam.level} 考試 ${daysUntil(exam.date, today)} 天</span>` : ''}
        <button class="icon-btn" data-go="settings" aria-label="設定">${ICON.gear}</button>
      </div>
    </div>
    <div class="row between">
      <div><h1>今天約 <span class="num">2</span> 小時</h1><p class="muted">可以分段做，中途離開下次會接著。</p></div>
      <div class="ring-wrap" style="width:72px;height:72px">
        <svg viewBox="0 0 120 120"><circle class="ring-bg" cx="60" cy="60" r="54"/><circle class="ring-fg" cx="60" cy="60" r="54" style="stroke-dashoffset:${339.3 * (1 - doneN / totalN)}"/></svg>
        <div class="ring-label num" style="font-size:15px">${doneN}/${totalN}</div>
      </div>
    </div>
    ${showGuide ? GUIDE : ''}
    <div class="card stack" style="gap:8px">
      <div class="row between"><h2>零碎時間</h2><span class="muted">1–3 分鐘</span></div>
      <div class="quick">
        <button data-quick="vocab">${ICON.bolt}單字快練<small>聽→跟念→看意思</small></button>
        <button data-quick="pron">${ICON.ear}發音聽辨<small>長音、促音、濁音</small></button>
      </div>
    </div>
    <div class="stack" style="gap:8px">${tasks.map(x => x.choices && x.choices.length ? `
      <div class="task ${x.done ? 'done' : ''} ${x === nextTask ? 'next' : ''}" style="flex-direction:column;align-items:stretch">
        <div class="row"><span class="task-ic">${x.done ? ICON.check : x.icon}</span>
          <span style="flex:1;min-width:0"><span class="t-title">${x.title}</span><span class="muted">${x.sub}</span></span></div>
        <div>${x.choices.map(e => `<button class="choice" data-ep="${e.id}">${seriesChip(e.series)}<span style="flex:1;min-width:0"><b>${epLabel(e)}</b><br><span class="muted">${esc(e.title_zh)}・${e.level}</span></span></button>`).join('')}</div>
      </div>` : `
      <button class="task ${x.done ? 'done' : ''} ${x.idle ? 'idle' : ''} ${x === nextTask ? 'next' : ''}" data-k="${x.k}">
        <span class="task-ic">${x.done ? ICON.check : x.icon}</span>
        <span style="flex:1;min-width:0"><span class="t-title">${x.title}</span><span class="muted">${x.sub}</span></span>
      </button>`).join('')}</div>
    <div class="card">
      <div class="row between"><h2>本週</h2><span class="muted">連續 ${streak(S.days, today)} 天</span></div>
      <div class="week muted">${weekDots(S.days, today).map((d, i) => `<div>${'一二三四五六日'[i]}<div class="dot ${d.done ? 'on' : ''} ${d.today ? 'today' : ''}"></div></div>`).join('')}</div>
    </div>
    <button class="cta" id="cta">${nextTask ? `繼續：${nextTask.title.replace(/<[^>]+>/g, '')}` : '今天辛苦了'}</button>`;

  root.querySelectorAll('[data-ep]').forEach(b => b.addEventListener('click', () => go(`ep/${b.dataset.ep}`)));
  root.querySelectorAll('[data-quick]').forEach(b => b.addEventListener('click', () => go(`quick/${b.dataset.quick}`)));
  root.querySelectorAll('button.task').forEach(b => b.addEventListener('click', async () => {
    const x = tasks.find(y => y.k === b.dataset.k);
    if (x.route) go(x.route);
    else { await toggleReading(); home(root); }
  }));
  root.querySelector('[data-go="settings"]').addEventListener('click', () => go('settings'));
  root.querySelector('#hideGuide')?.addEventListener('click', async () => {
    S.settings.guideSeen = true;
    await saveSettings();
    home(root);
  });
  root.querySelector('#cta').addEventListener('click', async () => {
    if (!nextTask) return;
    if (nextTask.route) go(nextTask.route);
    else { await toggleReading(); home(root); }
  });
}
