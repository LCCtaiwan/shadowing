// JLPT 頁：考試倒數、路線、各級單字／文法學習量、聽解題型正確率、模擬分數、記憶率。
import { S, todayStr, db } from '../state.js';
import { esc } from '../ui.js';
import { daysUntil } from '../lib/schedule.js';
import { TYPE_NAMES } from './drill.js';

// 各級新增的大約數量（非官方，見 docs/jlpt-research.md）
const VOCAB_REF = { N5: 800, N4: 700, N3: 2250, N2: 2250, N1: 4000 };
const GRAMMAR_REF = { N5: 70, N4: 60, N3: 70, N2: 60, N1: 60 };
const WD = '日月火水木金土';

export default async function jlpt(root) {
  const today = todayStr();
  const exams = S.index.exam_targets;
  const next = exams.find(e => e.date >= today);
  const phase = S.index.phases.find(p => today <= p.dates.split(' ~ ')[1]) || S.index.phases.at(-1);

  const learned = deck => {
    const by = {};
    const seen = new Set();
    for (const c of S.cards) {
      if (c.deck !== deck || c.state === 'new' || seen.has(c.note)) continue;
      seen.add(c.note);
      by[c.level] = (by[c.level] || 0) + 1;
    }
    return by;
  };
  const vocab = learned('vocab');
  const grammar = learned('grammar');

  const typeStats = {};
  const mocks = [];
  for (const [id, p] of Object.entries(S.progress.drills)) {
    const vals = Object.values(p.results || {});
    for (const r of vals) {
      typeStats[r.type] ||= [0, 0];
      typeStats[r.type][1]++;
      if (r.correct) typeStats[r.type][0]++;
    }
    if (p.kind === 'mock' && vals.length) mocks.push({ id, at: p.at, score: Math.round(vals.filter(r => r.correct).length / vals.length * 60) });
  }
  mocks.sort((a, b) => a.at - b.at);

  const logs = await db.allLogs();
  const since = Date.now() - 30 * 864e5;
  const recent = logs.filter(l => l.at >= since && l.from === 'review');
  const retention = recent.length ? Math.round(recent.filter(l => l.g > 1).length / recent.length * 100) : null;

  const meter = (label, n, ref) => `<div class="meter"><span>${label}</span><div class="bar"><i style="width:${Math.min(100, n / ref * 100)}%"></i></div><span class="num">${n} / ${ref}</span></div>`;
  const pct = ([c, n]) => Math.round(c / n * 100);

  root.innerHTML = `
    <h1>JLPT</h1>
    ${next ? `<div class="card"><p class="muted">次の試験</p><div class="row between" style="align-items:flex-end">
      <div><div style="font-size:22px;font-weight:700">${next.level}</div><div class="muted">${next.date.replace(/-/g, '/')}（${WD[new Date(`${next.date}T12:00:00`).getDay()]}）予定・申込は約 3 か月前</div></div>
      <div style="text-align:right"><div class="num" style="font-size:30px;font-weight:700;color:var(--brand)">${daysUntil(next.date, today)}</div><div class="muted">日</div></div></div></div>` : ''}
    <div class="card stack">
      <h2>ロードマップ</h2>
      <div class="road">${S.index.phases.map(p => `<div class="${p === phase ? 'now' : ''}"><b style="font-size:13px">${esc(p.name)}</b>${esc(p.dates.split(' ~ ')[1].slice(0, 7).replace('-', '/'))}まで</div>`).join('')}</div>
      <p class="muted">いま：${esc(phase.name)}。每天約 2 小時：Anki 35 分、跟讀 30 分、聽解ドリル 15 分、讀解教材 30 分。</p>
    </div>
    <div class="card stack">
      <h2>覚えた単語</h2>
      ${['N5', 'N4', 'N3', 'N2'].map(l => meter(`${l} 語彙`, vocab[l] || 0, VOCAB_REF[l])).join('')}
      <h2 style="margin-top:6px">覚えた文法</h2>
      ${['N5', 'N4', 'N3', 'N2'].map(l => meter(`${l} 文法`, grammar[l] || 0, GRAMMAR_REF[l])).join('')}
      <p class="muted">分母是各級大約新增的量（非官方推估），只當方向參考。</p>
    </div>
    <div class="card stack">
      <h2>聴解　題型別正答率</h2>
      ${Object.keys(typeStats).length ? Object.entries(typeStats).map(([t, s]) => `<div class="meter"><span>${TYPE_NAMES[t]}</span><div class="bar"><i style="width:${pct(s)}%"></i></div><span class="num">${pct(s)}%</span></div>`).join('')
        : '<p class="muted">做完第一份聴解ドリル後會顯示。</p>'}
    </div>
    <div class="card stack">
      <div class="row between"><h2>ミニ模試</h2>${mocks.length ? `<span class="num" style="font-weight:700">${mocks.at(-1).score} / 60</span>` : ''}</div>
      ${mocks.length ? `<div class="score" role="img" aria-label="最近 ${mocks.at(-1).score} 分，最低分 19 分"><i style="width:${mocks.at(-1).score / 60 * 100}%"></i><u style="left:${19 / 60 * 100}%"></u></div>
        <div class="row between muted"><span>紅線 = 各節最低 19 分</span><span>${mocks.map(m => m.score).join(' → ')}</span></div>`
        : '<p class="muted">每週日的ミニ模試做完後會顯示換算分數。</p>'}
    </div>
    <div class="card row between"><span>最近 30 日の記憶率</span><b class="num">${retention === null ? '—' : `${retention}%`}</b></div>
    <p class="muted">考前 8 週起，建議每兩週做一次官方『日本語能力試験 公式問題集』，把分數記下來對照。</p>`;
}
