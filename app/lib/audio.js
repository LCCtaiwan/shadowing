// 播放 Gemini 配音 mp3；該段還沒配音時退回系統日語語音。另含螢幕常亮與鎖屏控制。
const manifests = new Map();
const el = new Audio();
el.preload = 'auto';
let token = 0;
let jaVoice = null;

function pickVoice() {
  try {
    const ja = speechSynthesis.getVoices().filter(v => /^ja/i.test(v.lang));
    jaVoice = ja.find(v => /Kyoko|O-ren|Otoya|Hattori|Google/i.test(v.name)) || ja[0] || null;
  } catch { jaVoice = null; }
}
try { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; } catch { /* 沒有語音合成 */ }

export async function manifest(dir) {
  if (!manifests.has(dir)) {
    manifests.set(dir, fetch(`${dir}/manifest.json`).then(r => (r.ok ? r.json() : {})).catch(() => ({})));
  }
  return manifests.get(dir);
}

export async function hasAudio(dir, key) {
  return Boolean((await manifest(dir))[key]);
}

export function stop() {
  token++;
  try { el.pause(); } catch { /* ignore */ }
  try { speechSynthesis.cancel(); } catch { /* ignore */ }
}

function speakFallback(text, rate) {
  return new Promise(resolve => {
    const est = Math.max(900, text.length * 190 / rate);
    try {
      if (!('speechSynthesis' in window)) return setTimeout(resolve, est);
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ja-JP';
      u.rate = rate;
      if (jaVoice) u.voice = jaVoice;
      let done = false;
      const end = () => { if (!done) { done = true; resolve(); } };
      u.onend = end;
      u.onerror = end;
      setTimeout(end, est + 4000);
      speechSynthesis.speak(u);
    } catch {
      setTimeout(resolve, est);
    }
  });
}

/**
 * 播一段。resolve 時回傳 { ms: 實際播放毫秒, source: 'gemini' | 'system' }；被 stop() 打斷時 cancelled 為 true。
 * @param fallbackText 沒有 mp3 時給系統語音唸的文字（建議用假名，避免誤讀）
 */
export async function play(dir, key, fallbackText, rate = 1) {
  stop();
  const my = ++token;
  const t0 = performance.now();
  const entry = (await manifest(dir))[key];
  if (my !== token) return { ms: 0, cancelled: true };
  if (entry) {
    await new Promise(resolve => {
      el.src = `${dir}/${entry.file}`;
      el.playbackRate = rate;
      el.preservesPitch = true;
      el.onended = resolve;
      el.onerror = resolve;
      el.onpause = () => { if (my !== token) resolve(); };
      el.play().catch(resolve);
    });
    return { ms: performance.now() - t0, source: 'gemini', cancelled: my !== token };
  }
  await speakFallback(fallbackText, rate);
  return { ms: performance.now() - t0, source: 'system', cancelled: my !== token };
}

export const wait = ms => new Promise(r => setTimeout(r, ms));
export const currentToken = () => token;

let lock = null;
export async function keepAwake(on) {
  try {
    if (on && !lock && navigator.wakeLock) lock = await navigator.wakeLock.request('screen');
    if (!on && lock) { await lock.release(); lock = null; }
  } catch { lock = null; }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && lock) { lock = null; keepAwake(true); } });

/** 鎖屏與耳機線控。handlers: { play, pause, next, prev } */
export function mediaSession(title, artist, handlers) {
  if (!('mediaSession' in navigator)) return;
  navigator.mediaSession.metadata = new MediaMetadata({ title, artist, album: 'シャドー日本語' });
  const map = { play: 'play', pause: 'pause', nexttrack: 'next', previoustrack: 'prev' };
  for (const [action, name] of Object.entries(map)) {
    try { navigator.mediaSession.setActionHandler(action, handlers?.[name] || null); } catch { /* 不支援 */ }
  }
}

/** 先把整集音檔抓下來（讓 service worker 快取，之後離線可播）。回傳下載段數。 */
export async function prefetch(dir) {
  const m = await manifest(dir);
  const files = [...new Set(Object.values(m).map(e => e.file))];
  await Promise.all(files.map(f => fetch(`${dir}/${f}`).catch(() => null)));
  return files.length;
}
