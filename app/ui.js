// 共用的小工具與圖示。
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export { esc } from './lib/ruby.js';

const svg = d => `<svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
export const ICON = {
  play: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5l12 7-12 7z" fill="currentColor" stroke="none"/></svg>',
  pause: svg('<path d="M8 5v14M16 5v14" stroke-width="3"/>'),
  prev: svg('<path d="M18 6l-8 6 8 6zM6 6v12"/>'),
  next: svg('<path d="M6 6l8 6-8 6zM18 6v12"/>'),
  repeat: svg('<path d="M17 2l3 3-3 3"/><path d="M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3"/><path d="M20 13v2a4 4 0 0 1-4 4H4"/>'),
  vol: svg('<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>'),
  eye: '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  check: svg('<path d="M5 12l5 5 9-10"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  cards: svg('<rect x="4" y="7" width="13" height="13" rx="2"/><path d="M8 4h10a2 2 0 0 1 2 2v10"/>'),
  head: svg('<path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="3" y="14" width="4" height="6" rx="1.5"/><rect x="17" y="14" width="4" height="6" rx="1.5"/>'),
  book: svg('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5"/>'),
  tv: svg('<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M8 21h8M9 3l3 3 3-3"/>'),
  home: svg('<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/>'),
  lib: svg('<path d="M5 4h4v16H5zM10 4h4v16h-4zM15.5 5l3.8 1-3.7 14-3.8-1z"/>'),
  chart: svg('<path d="M5 20V10M12 20V4M19 20v-7"/>'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  download: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
  flag: svg('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
  bolt: svg('<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>'),
  mic: svg('<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
  ear: svg('<path d="M6 9a6 6 0 1 1 12 0c0 3-2 4-3 5s-1 3-3 4-4 0-4-2"/><path d="M9 9a3 3 0 0 1 6 0"/>'),
};

let toastTimer;
export function toast(msg, ms = 3200) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

export const SERIES_ORDER = ['family', 'anime', 'drama'];
export const SERIES_LABEL = { family: '家族旅行', anime: '動漫', drama: '自助旅行' };
export const SERIES_NAME = { family: '三世代で日本へ', anime: '放課後ラジオ部', drama: '終電のあとで' };
export const SERIES_ZH = { family: '三代同堂遊日本', anime: '放學後廣播社', drama: '末班車之後' };
const SERIES_CHIP = { family: 'family', anime: 'anime', drama: 'brand' };
export const seriesChip = series => `<span class="chip ${SERIES_CHIP[series] || ''}">${SERIES_LABEL[series] || series}</span>`;
export const wave = (n = 22) => `<div class="wave">${Array.from({ length: n }, (_, i) => `<i style="animation-delay:${(i * 73) % 600}ms"></i>`).join('')}</div>`;

export function ring(id, label = '') {
  return `<div class="ring-wrap"><svg viewBox="0 0 120 120"><circle class="ring-bg" cx="60" cy="60" r="54"/><circle class="ring-fg" id="${id}" cx="60" cy="60" r="54"/></svg><div class="ring-label">${label}</div></div>`;
}

export function animateRing(el, ms) {
  if (!el) return;
  el.style.transition = 'none';
  el.style.strokeDashoffset = 339.3;
  el.getBoundingClientRect();
  if (ms > 0) {
    el.style.transition = `stroke-dashoffset ${ms}ms linear`;
    el.style.strokeDashoffset = 0;
  }
}

export const speakerName = (cast, id) => (cast[id]?.name || id).replace(/（.*?）/g, '');
