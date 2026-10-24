// 設定：顯示、跟讀、複習上限、讀解教材、每週回饋、備份與還原、關於。
import { S, saveSettings, db, todayStr } from '../state.js';
import { $, $$, ICON, esc, toast } from '../ui.js';
import { DECKS, DECK_NAMES } from '../lib/cards.js';
import { go } from '../main.js';

export default function settings(root) {
  const s = S.settings;
  root.innerHTML = `
    <div class="row between"><button class="icon-btn" id="back" aria-label="戻る">${ICON.close}</button><h1>設定</h1><span style="width:44px"></span></div>
    <div class="card">
      <div class="field"><label for="ruby">ふりがな</label><select id="ruby">
        <option value="furi">漢字＋かな</option><option value="kana">かなだけ</option><option value="hide">隠す</option></select></div>
      <div class="field"><label for="large">大きい文字</label><input type="checkbox" id="large" ${s.largeText ? 'checked' : ''}></div>
    </div>
    <div class="card">
      <h2>シャドーイング</h2>
      <div class="field"><label for="repeats">各文の回数</label><input type="number" id="repeats" min="1" max="5" value="${s.repeats}"></div>
      <div class="field"><label for="pause">間の長さ（文の長さ×）</label><input type="number" id="pause" min="0.8" max="3" step="0.1" value="${s.pauseFactor}"></div>
      <div class="field"><label for="speed">速さ</label><select id="speed"><option value="0.75">0.75×</option><option value="0.9">0.9×</option><option value="1">1×</option></select></div>
    </div>
    <div class="card">
      <h2>復習（1 日あたり）</h2>
      ${DECKS.map(d => `<div class="field"><label for="new-${d}">新しい${DECK_NAMES[d]}</label><input type="number" id="new-${d}" min="0" max="100" value="${s.limits.new[d]}"></div>`).join('')}
      <div class="field"><label for="reviewLimit">復習の上限</label><input type="number" id="reviewLimit" min="10" max="999" value="${s.limits.review}"></div>
      <div class="field"><label for="retention">目標記憶率（%）</label><input type="number" id="retention" min="80" max="97" value="${Math.round(s.retention * 100)}"></div>
    </div>
    <div class="card">
      <h2>読解の教材</h2>
      <div class="field"><label for="reading">教材名</label><input type="text" id="reading" value="${esc(s.reading)}"></div>
    </div>
    <div class="card stack">
      <h2>今週のフィードバック</h2>
      <p class="muted" id="fbText"></p>
      <div class="field"><label for="repo">GitHub repo</label><input type="text" id="repo" placeholder="LCCtaiwan/shadowing" value="${esc(s.feedbackRepo)}"></div>
      <button class="ghost" id="feedback">GitHub issue で送る</button>
      <p class="muted">Claude 每週寫下一週劇本時會讀這份回饋調整難度。需要已登入 GitHub。</p>
    </div>
    <div class="card stack">
      <h2>バックアップ</h2>
      <p class="muted">進度和卡片只存在這台手機。換手機或清除資料前，先匯出備份。</p>
      <div class="row wrap"><button class="ghost" id="export">${ICON.download} 書き出す</button>
        <label class="ghost row" style="cursor:pointer">読み込む<input type="file" id="import" accept="application/json" hidden></label></div>
      <button class="ghost" id="wipe" style="color:var(--bad)">すべてのデータを消す</button>
    </div>
    <div class="card stack">
      <h2>このアプリについて</h2>
      <p class="muted">劇本與聽解題全部由 Claude 原創，不使用市售教材或 JLPT 真題。配音：Google Gemini TTS。複習排程：FSRS-5 演算法（open-spaced-repetition）。JLPT 範圍數字為非官方推估。</p>
    </div>`;

  $('#ruby', root).value = s.ruby;
  $('#speed', root).value = String(s.speed);
  const num = (sel, min, max) => Math.min(max, Math.max(min, Number($(sel, root).value) || min));
  async function save() {
    s.ruby = $('#ruby', root).value;
    s.largeText = $('#large', root).checked;
    s.repeats = num('#repeats', 1, 5);
    s.pauseFactor = num('#pause', 0.8, 3);
    s.speed = Number($('#speed', root).value);
    for (const d of DECKS) s.limits.new[d] = num(`#new-${d}`, 0, 100);
    s.limits.review = num('#reviewLimit', 10, 999);
    s.retention = num('#retention', 80, 97) / 100;
    s.reading = $('#reading', root).value.trim() || '読解教材';
    s.feedbackRepo = $('#repo', root).value.trim();
    document.documentElement.dataset.size = s.largeText ? 'large' : '';
    await saveSettings();
    toast('保存しました');
  }
  $$('input, select', root).forEach(el => { if (el.id !== 'import') el.addEventListener('change', save); });
  $('#back', root).addEventListener('click', () => go('home'));

  const week = Date.now() - 7 * 864e5;
  const eps = S.index.episodes.filter(e => S.progress.episodes[e.id]?.at >= week);
  const dr = Object.entries(S.progress.drills).filter(([, p]) => p.at >= week);
  const correct = dr.flatMap(([, p]) => Object.values(p.results || {}));
  const diffName = { easy: '簡單すぎ', ok: 'ちょうどいい', hard: '難しい' };
  const body = [
    `期間：${new Date(week).toISOString().slice(0, 10)} ～ ${todayStr()}`,
    '',
    '## 完成的集數與難度',
    ...(eps.length ? eps.map(e => `- ${e.id} ${e.title}：${diffName[S.progress.episodes[e.id].difficulty] || '未回答'}`) : ['- （無）']),
    '',
    '## 聴解ドリル',
    `- 份數 ${dr.length}，正答 ${correct.filter(r => r.correct).length} / ${correct.length}`,
    '',
    '## 複習',
    `- 卡片總數 ${S.cards.length}，頑固卡 ${S.cards.filter(c => c.flagged).length}`,
  ].join('\n');
  $('#fbText', root).textContent = `本週完成 ${eps.length} 話、ドリル ${dr.length} 份。`;
  $('#feedback', root).addEventListener('click', () => {
    if (!s.feedbackRepo) return toast('先填 GitHub repo（例：LCCtaiwan/shadowing）');
    const url = `https://github.com/${s.feedbackRepo}/issues/new?labels=feedback&title=${encodeURIComponent(`本週回饋 ${todayStr()}`)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank', 'noopener');
  });

  $('#export', root).addEventListener('click', async () => {
    const data = await db.exportAll();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `shadowing-backup-${todayStr()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
  $('#import', root).addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      await db.importAll(JSON.parse(await file.text()));
      toast('バックアップを読み込みました');
      setTimeout(() => location.reload(), 800);
    } catch (err) {
      toast(`讀不進來：${err.message}`);
    }
  });
  let armed = false;
  $('#wipe', root).addEventListener('click', async e => {
    if (!armed) {
      armed = true;
      e.currentTarget.textContent = 'もう一度押すと全部消えます';
      setTimeout(() => { armed = false; e.target.textContent = 'すべてのデータを消す'; }, 4000);
      return;
    }
    await db.wipe();
    location.reload();
  });
}
