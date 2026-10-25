// 手寫板：一個字一格（田字格），手指或 Apple Pencil 書寫；看答案時把正確字形淡淡疊在格子底下比對。
const FONT = '"Klee One", "Hiragino Mincho ProN", "Yu Mincho", "Noto Serif JP", serif';

export function createPad(container, answer) {
  const chars = [...answer];
  const cols = Math.min(4, chars.length);
  const rows = Math.ceil(chars.length / cols);
  const wrap = document.createElement('div');
  wrap.className = 'pad';
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-label', '手寫區：用手指或筆寫出這個字');
  wrap.append(canvas);
  container.append(wrap);

  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const width = Math.min(container.clientWidth || 320, 420);
  const cell = Math.floor(width / cols);
  const W = cell * cols, H = cell * rows;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const strokes = [];
  let current = null;
  let revealed = false;
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';

  function grid() {
    ctx.save();
    ctx.strokeStyle = css('--line');
    ctx.lineWidth = 1;
    for (let i = 0; i < chars.length; i++) {
      const x = (i % cols) * cell, y = Math.floor(i / cols) * cell;
      ctx.setLineDash([]);
      ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.moveTo(x + cell / 2, y + 6); ctx.lineTo(x + cell / 2, y + cell - 6);
      ctx.moveTo(x + 6, y + cell / 2); ctx.lineTo(x + cell - 6, y + cell / 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function ghost() {
    ctx.save();
    ctx.fillStyle = css('--brand-strong');
    ctx.globalAlpha = 0.22;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(cell * 0.78)}px ${FONT}`;
    chars.forEach((ch, i) => ctx.fillText(ch, (i % cols) * cell + cell / 2, Math.floor(i / cols) * cell + cell / 2 + cell * 0.03));
    ctx.restore();
  }

  function drawStroke(s) {
    if (s.length < 2) {
      const p = s[0];
      ctx.beginPath(); ctx.arc(p.x, p.y, p.w / 2, 0, Math.PI * 2); ctx.fill();
      return;
    }
    for (let i = 1; i < s.length; i++) {
      const a = s[i - 1], b = s[i];
      ctx.lineWidth = (a.w + b.w) / 2;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
  }

  function redraw() {
    ctx.clearRect(0, 0, W, H);
    grid();
    if (revealed) ghost();
    ctx.save();
    ctx.strokeStyle = ctx.fillStyle = css('--ink');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    strokes.forEach(drawStroke);
    ctx.restore();
  }

  const point = e => {
    const r = canvas.getBoundingClientRect();
    const pressure = e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5;
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: Math.max(2.5, cell * 0.06 * (0.6 + pressure)) };
  };
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* 合成事件沒有可捕捉的指標 */ }
    current = [point(e)];
    strokes.push(current);
    redraw();
  });
  canvas.addEventListener('pointermove', e => {
    if (!current) return;
    e.preventDefault();
    const evs = e.getCoalescedEvents?.();
    for (const ev of evs && evs.length ? evs : [e]) current.push(point(ev));
    redraw();
  });
  const end = () => { current = null; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);

  redraw();
  return {
    undo() { strokes.pop(); redraw(); },
    clear() { strokes.length = 0; redraw(); },
    reveal() { revealed = true; redraw(); },
    get empty() { return strokes.length === 0; },
  };
}
