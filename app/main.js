import { boot, S } from './state.js';
import { $, ICON } from './ui.js';
import { stop, keepAwake } from './lib/audio.js';
import home from './views/home.js';
import episode from './views/episode.js';
import review from './views/review.js';
import drill from './views/drill.js';
import library from './views/library.js';
import jlpt from './views/jlpt.js';
import settings from './views/settings.js';

const VIEWS = { home, ep: episode, review, drill, lib: library, jlpt, settings };
const TABS = [['home', 'ホーム', ICON.home], ['lib', 'ライブラリ', ICON.lib], ['review', '復習', ICON.cards], ['drill', 'ドリル', ICON.head], ['jlpt', 'JLPT', ICON.chart]];

export function go(route) {
  if (location.hash === `#${route}`) render();
  else location.hash = route;
}

let cleanup = null;
async function render() {
  stop();
  keepAwake(false);
  if (cleanup) { cleanup(); cleanup = null; }
  const [name, ...args] = (location.hash.slice(1) || 'home').split('/');
  const view = VIEWS[name] || home;
  document.body.classList.remove('focus');
  $('#tabs').innerHTML = TABS.map(([k, label, icon]) =>
    `<button class="tab" data-tab="${k}" ${k === name ? 'aria-current="page"' : ''}>${icon}${label}</button>`).join('');
  const root = $('#view');
  root.innerHTML = '';
  try {
    cleanup = (await view(root, args.map(decodeURIComponent))) || null;
  } catch (e) {
    console.error(e);
    root.innerHTML = `<div class="card empty"><p>畫面載入失敗：${e.message}</p><p class="muted">請確認網路連線後重新整理。</p></div>`;
  }
  window.scrollTo(0, 0);
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-tab]');
  if (t) go(t.dataset.tab);
});
window.addEventListener('hashchange', render);

(async () => {
  try {
    await boot();
  } catch (e) {
    console.error(e);
    $('#view').innerHTML = '<div class="card empty"><p>課程資料讀不到。</p><p class="muted">第一次使用需要連網；之後已下載的集數可以離線練習。</p></div>';
    return;
  }
  if (S.settings.largeText) document.documentElement.dataset.size = 'large';
  await render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(e => console.warn('service worker', e));
  }
})();
