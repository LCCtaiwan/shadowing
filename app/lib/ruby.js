// 假名顯示：furi（漢字＋かな）、kana（只假名）、hide（隱藏）。focus 子字串加底色。
export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function focusRanges(text, focus = []) {
  const ranges = [];
  for (const f of focus) {
    let i = text.indexOf(f);
    while (i >= 0) {
      ranges.push([i, i + f.length]);
      i = text.indexOf(f, i + f.length);
    }
  }
  return ranges;
}

export function renderRuby(ruby, mode = 'furi', focus = []) {
  const text = ruby.map(s => s[0]).join('');
  const ranges = focusRanges(text, focus);
  const marked = (a, b) => ranges.some(([x, y]) => a < y && b > x);
  let pos = 0;
  let html = '';
  for (const [t, r] of ruby) {
    const a = pos, b = pos + t.length;
    pos = b;
    if (!r) {
      // 假名片段可逐字切開，只標重點範圍內的字
      for (let i = 0; i < t.length; i++) html += marked(a + i, a + i + 1) ? `<mark>${esc(t[i])}</mark>` : esc(t[i]);
      continue;
    }
    const body = mode === 'kana' ? esc(r) : `<ruby>${esc(t)}<rt>${esc(r)}</rt></ruby>`;
    html += marked(a, b) ? `<mark>${body}</mark>` : body;
  }
  return html.replace(/<\/mark><mark>/g, '');
}

export const plainText = ruby => ruby.map(s => s[0]).join('');
export const kanaText = ruby => ruby.map(s => s[1] || s[0]).join('');
