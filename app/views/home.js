import { S, todayStr, toggleReading } from '../state.js';
import { ICON, esc, seriesChip } from '../ui.js';
import { todayTasks, daysUntil, streak, weekDots } from '../lib/schedule.js';
import { buildQueue, deckCounts, estimateMinutes, dayKey } from '../lib/srs.js';
import { go } from '../main.js';

const WD = '日月火水木金土';

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

  const tasks = [
    {
      k: 'review', icon: ICON.cards, done: reviewLeft === 0 && reviewedToday > 0, idle: reviewLeft === 0 && !reviewedToday,
      title: reviewLeft ? `復習 ${reviewLeft} 枚` : (reviewedToday ? `復習 ${reviewedToday} 枚 完了` : '復習（まだカードなし）'),
      sub: reviewLeft ? `単語・文法・フレーズ・文　約 ${Math.max(1, reviewMin)} 分` : (S.cards.length ? '今日の分は終わりました' : '一話を終えると、カードがここに入ります'),
      route: 'review',
    },
    epDone.length
      ? { k: 'ep', icon: ICON.tv, done: true, title: `第${epDone.at(-1).episode}話　${esc(epDone.at(-1).title)}`,
        sub: t.episode ? `余裕があれば次も：第${t.episode.episode}話 ${esc(t.episode.title)}` : '今日の一話、完了', route: t.episode ? `ep/${t.episode.id}` : `ep/${epDone.at(-1).id}` }
      : t.episode
        ? { k: 'ep', icon: ICON.tv, done: false, title: `第${t.episode.episode}話　${esc(t.episode.title)}`,
          sub: `${seriesChip(t.episode.series)} ${t.episode.level}　${t.episode.lines} 文　約 25 分`, route: `ep/${t.episode.id}` }
        : { k: 'ep', icon: ICON.tv, done: false, idle: true, title: '今日の新しい話はありません',
          sub: t.upcoming ? `次は ${t.upcoming.date.slice(5).replace('-', '/')}：${esc(t.upcoming.title)}` : '次のエピソードを準備中', route: 'lib' },
    drDone.length
      ? { k: 'drill', icon: ICON.head, done: true, title: '聴解ドリル 完了', sub: t.drill ? 'たまっている分もあります（ドリルタブ）' : '結果は JLPT タブで', route: t.drill ? `drill/${t.drill.id}` : 'jlpt' }
      : t.drill
        ? { k: 'drill', icon: ICON.head, done: false, title: t.drill.kind === 'mock' ? '週末ミニ模試' : '聴解ドリル',
          sub: `${t.drill.items} 問　約 ${t.drill.kind === 'mock' ? 20 : 15} 分`, route: `drill/${t.drill.id}` }
        : { k: 'drill', icon: ICON.head, done: false, idle: true, title: '今日のドリルはありません', sub: '', route: 'lib' },
    { k: 'reading', icon: ICON.book, done: Boolean(S.reading[today]), title: '読解（教材）', sub: `${esc(S.settings.reading)}　約 30 分　自分でチェック`, route: null },
  ];
  const nextTask = tasks.find(x => !x.done && !x.idle);
  const active = tasks.filter(x => !x.idle);
  const doneN = active.filter(x => x.done).length;
  const totalN = Math.max(1, active.length);
  const exam = S.index.exam_targets.find(e => e.date >= today);
  const now = new Date(`${today}T12:00:00`);

  root.innerHTML = `
    <div class="row between">
      <span class="muted">${now.getMonth() + 1}月${now.getDate()}日（${WD[now.getDay()]}）</span>
      <div class="row" style="gap:6px">
        ${exam ? `<span class="chip brand num">${exam.level} まで ${daysUntil(exam.date, today)} 日</span>` : ''}
        <button class="icon-btn" data-go="settings" aria-label="設定">${ICON.gear}</button>
      </div>
    </div>
    <div class="row between">
      <div><h1>今日は約 <span class="num">2</span> 時間</h1><p class="muted">分けてやっても大丈夫。途中から続けられます。</p></div>
      <div class="ring-wrap" style="width:72px;height:72px">
        <svg viewBox="0 0 120 120"><circle class="ring-bg" cx="60" cy="60" r="54"/><circle class="ring-fg" cx="60" cy="60" r="54" style="stroke-dashoffset:${339.3 * (1 - doneN / totalN)}"/></svg>
        <div class="ring-label num" style="font-size:15px">${doneN}/${totalN}</div>
      </div>
    </div>
    ${t.behind > 1 ? `<div class="card flat muted">まだ ${t.behind} 話たまっています。古い順に進めれば大丈夫。</div>` : ''}
    <div class="stack" style="gap:8px">${tasks.map(x => `
      <button class="task ${x.done ? 'done' : ''} ${x.idle ? 'idle' : ''} ${x === nextTask ? 'next' : ''}" data-k="${x.k}">
        <span class="task-ic">${x.done ? ICON.check : x.icon}</span>
        <span style="flex:1;min-width:0"><span class="t-title">${x.title}</span><span class="muted">${x.sub}</span></span>
      </button>`).join('')}</div>
    <div class="card">
      <div class="row between"><h2>今週</h2><span class="muted">連続 ${streak(S.days, today)} 日</span></div>
      <div class="week muted">${weekDots(S.days, today).map((d, i) => `<div>${'月火水木金土日'[i]}<div class="dot ${d.done ? 'on' : ''} ${d.today ? 'today' : ''}"></div></div>`).join('')}</div>
    </div>
    <button class="cta" id="cta">${nextTask ? `続ける：${nextTask.title.replace(/<[^>]+>/g, '')}` : '今日はおつかれさま'}</button>`;

  root.querySelectorAll('.task').forEach(b => b.addEventListener('click', async () => {
    const x = tasks.find(y => y.k === b.dataset.k);
    if (x.route) go(x.route);
    else { await toggleReading(); home(root); }
  }));
  root.querySelector('[data-go="settings"]').addEventListener('click', () => go('settings'));
  root.querySelector('#cta').addEventListener('click', async () => {
    if (!nextTask) return;
    if (nextTask.route) go(nextTask.route);
    else { await toggleReading(); home(root); }
  });
}
