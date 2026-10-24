#!/usr/bin/env python3
"""檢查劇本與聽解ドリル JSON 是否符合 docs/content-spec.md。

用法：python3 tools/validate.py [檔案或資料夾 ...]（預設檢查 scripts/）
有錯誤時 exit code 為 1；重複新教的單字只列為警告。
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEVELS = {"N5", "N4", "N3", "N2", "N1"}
SERIES = {"drama", "anime", "family", "kids", "tales"}
DRILL_TYPES = {"sokuji", "kadai", "point", "gaiyo", "hatsuwa", "togo"}
KANJI = re.compile(r"[㐀-鿿々]")
KANA_ONLY = re.compile(r"^[ぁ-ゟ゠-ヿー・]+$")
# 日文要用新字體；這些是常被誤打成中文繁體的字（舊 → 日文寫法）
TRAD = {p[0]: p[1] for p in "黃黄 圖図 號号 體体 醫医 藥薬 國国 學学 寫写 讀読 價価 錢銭 驛駅 氣気 來来 發発 變変 鐵鉄 廣広 樂楽 賣売 歸帰 應応 對対 單単 觀観 驗験 齒歯 乘乗 鹽塩 樣様 戶戸 內内 黑黒 淺浅 經経 續続 繪絵 兩両 將将 險険 濟済 畫画 聽聴 說説 與与 參参 舊旧 壓圧 團団 圓円 實実 當当 會会 從従 關関 澤沢 擇択 轉転 輕軽 顏顔 麵麺 點点 燈灯 處処 歲歳 濱浜 櫻桜 邊辺 錄録 綠緑 狀状 戰戦 數数 寶宝 鬆松".split() if p[0] != p[1]}


def load_casts():
    cast = {}
    for p in sorted((ROOT / "story" / "ja").glob("**/cast.json")):
        for cid, info in json.loads(p.read_text(encoding="utf-8")).items():
            if cid in cast:
                raise SystemExit(f"cast id 重複：{cid}（{p}）")
            cast[cid] = info
    return cast


class Report:
    def __init__(self):
        self.errors, self.warnings = [], []

    def err(self, where, msg):
        self.errors.append(f"{where}: {msg}")

    def warn(self, where, msg):
        self.warnings.append(f"{where}: {msg}")


def check_ruby(rep, where, obj):
    """obj 需有 text 與 ruby；ruby 為 [[字], [漢字, 讀音], ...]。"""
    text, ruby = obj.get("text"), obj.get("ruby")
    if not isinstance(text, str) or not text:
        rep.err(where, "缺少 text")
        return
    if not isinstance(ruby, list) or not ruby:
        rep.err(where, "缺少 ruby")
        return
    joined = ""
    for seg in ruby:
        if not isinstance(seg, list) or not 1 <= len(seg) <= 2 or not all(isinstance(s, str) for s in seg):
            rep.err(where, f"ruby 片段格式錯誤：{seg!r}")
            continue
        joined += seg[0]
        if len(seg) == 2:
            if not KANA_ONLY.match(seg[1]):
                rep.err(where, f"讀音必須是假名：{seg!r}")
        elif KANJI.search(seg[0]):
            rep.err(where, f"含漢字卻沒有讀音：{seg[0]!r}")
    if joined != text:
        rep.err(where, f"ruby 拼起來與 text 不同：{joined!r} ≠ {text!r}")
    bad = sorted({c for c in text if c in TRAD})
    if bad:
        rep.err(where, "日文裡混了中文繁體字：" + "、".join(f"{c}→{TRAD[c]}" for c in bad))


def need(rep, where, obj, keys):
    ok = True
    for k in keys:
        if k not in obj or obj[k] in ("", None, []):
            rep.err(where, f"缺少欄位 {k}")
            ok = False
    return ok


def check_links(rep, where, links):
    if not links:
        return
    for c in links.get("collocations", []):
        if need(rep, f"{where} 搭配", c, ["cue", "text", "zh"]):
            if not c["text"].startswith(c["cue"]) or c["text"] == c["cue"]:
                rep.err(where, f"搭配的 text 必須以 cue 開頭且更長：{c['cue']} / {c['text']}")
            bad = sorted({ch for ch in c["text"] if ch in TRAD})
            if bad:
                rep.err(where, f"搭配混了中文繁體字：{c['text']}")
    for kind in ("opposite", "related"):
        for x in links.get(kind, []):
            if need(rep, f"{where} {kind}", x, ["text", "reading", "zh"]) and not KANA_ONLY.match(x["reading"]):
                rep.err(where, f"{kind} 讀音必須是假名：{x['text']}")


def check_options(rep, where, item):
    opts, ans = item.get("options"), item.get("answer")
    if not isinstance(opts, list) or len(opts) < 3:
        rep.err(where, "options 至少 3 個")
        return
    if not isinstance(ans, int) or not 0 <= ans < len(opts):
        rep.err(where, f"answer 超出範圍：{ans!r}")


def check_episode(rep, path, data, cast, seen):
    w = path.name
    if not need(rep, w, data, ["id", "lang", "series", "week", "episode", "level", "title", "title_zh",
                               "recap", "focus", "scenes", "vocab", "phrases", "grammar", "questions"]):
        return
    if data["series"] not in SERIES:
        rep.err(w, f"series 不明：{data['series']}")
    if data["level"] not in LEVELS:
        rep.err(w, f"level 不明：{data['level']}")
    check_ruby(rep, f"{w} recap", data["recap"])
    need(rep, f"{w} recap", data["recap"], ["zh"])
    need(rep, f"{w} focus", data["focus"], ["title", "zh"])

    lines = {}
    for sc in data["scenes"]:
        if not need(rep, w, sc, ["id", "lines"]):
            continue
        if sc.get("kind", "scene") not in {"scene", "radio"}:
            rep.err(w, f"scene kind 不明：{sc.get('kind')}")
        for ln in sc["lines"]:
            lw = f"{w} {ln.get('id', '?')}"
            if not need(rep, lw, ln, ["id", "speaker", "text", "ruby", "zh"]):
                continue
            if not ln["id"].startswith(sc["id"] + "-"):
                rep.err(lw, f"line id 應以 {sc['id']}- 開頭")
            if ln["id"] in lines:
                rep.err(lw, "line id 重複")
            if ln["speaker"] not in cast:
                rep.err(lw, f"speaker 不在 cast：{ln['speaker']}")
            check_ruby(rep, lw, ln)
            for f in ln.get("focus", []):
                if f not in ln["text"]:
                    rep.err(lw, f"focus 不在句中：{f!r}")
            lines[ln["id"]] = ln
    n = len(lines)
    lo, hi = {"kids": (12, 18), "tales": (15, 45)}.get(data["series"], (16, 36))
    if not lo <= n <= hi:
        rep.warn(w, f"句數 {n}（建議 {lo}–{hi}）")

    def link(kind, item, need_surface):
        iw = f"{w} {kind} {item.get('id', '?')}"
        ln = lines.get(item.get("line"))
        if ln is None:
            rep.err(iw, f"line 不存在：{item.get('line')}")
            return
        surface = item.get("surface")
        if need_surface and not surface:
            rep.err(iw, "缺少 surface")
        if surface and surface not in ln["text"]:
            rep.err(iw, f"surface 不在句中：{surface!r} / {ln['text']}")

    for v in data["vocab"]:
        if need(rep, f"{w} vocab", v, ["id", "text", "reading", "pos", "zh", "level", "line"]):
            bad = sorted({c for c in v["text"] + v["id"] + v.get("pos", "") if c in TRAD})
            if bad:
                rep.err(w, f"vocab 混了中文繁體字：{v['id']}（" + "、".join(f"{c}→{TRAD[c]}" for c in bad) + "）")
            if not v["id"].startswith("ja:vocab:"):
                rep.err(w, f"vocab id 格式：{v['id']}")
            if not KANA_ONLY.match(v["reading"]):
                rep.err(w, f"vocab 讀音必須是假名：{v['id']}")
            if v["level"] not in LEVELS:
                rep.err(w, f"vocab level：{v['id']}")
            link("vocab", v, False)
            check_links(rep, f"{w} {v['id']}", v.get("links"))
            # 三部劇使用者可任選順序，只檢查同一部劇內有沒有重複新教
            key = (data["series"], v["id"])
            if key in seen and not v.get("review"):
                rep.warn(w, f"單字已在同一部劇的 {seen[key]} 教過，若是複習請加 \"review\": true：{v['id']}")
            seen.setdefault(key, w)
    for p in data["phrases"]:
        if need(rep, f"{w} phrase", p, ["id", "text", "surface", "zh", "line"]):
            if not p["id"].startswith("ja:phrase:"):
                rep.err(w, f"phrase id 格式：{p['id']}")
            link("phrase", p, True)
    if data["series"] == "tales":
        if len(data["grammar"]) > 2:
            rep.warn(w, "童話文法點最多 2 個")
        if not data.get("source"):
            rep.err(w, "童話缺少 source（出處）")
    elif len(data["grammar"]) != 2:
        rep.warn(w, f"文法點 {len(data['grammar'])} 個（規格為 2）")
    for g in data["grammar"]:
        if need(rep, f"{w} grammar", g, ["id", "pattern", "zh", "level", "line", "surface", "examples"]):
            if not g["id"].startswith("ja:grammar:"):
                rep.err(w, f"grammar id 格式：{g['id']}")
            link("grammar", g, True)
            if len(g["examples"]) < 2:
                rep.err(w, f"grammar 例句至少 2 個：{g['id']}")
            for i, ex in enumerate(g["examples"]):
                check_ruby(rep, f"{w} {g['id']} 例句{i + 1}", ex)
                need(rep, f"{w} {g['id']} 例句{i + 1}", ex, ["zh"])
    for i, q in enumerate(data["questions"]):
        qw = f"{w} 問題{i + 1}"
        if need(rep, qw, q, ["q", "q_zh", "options", "answer"]):
            check_options(rep, qw, q)


def check_drill(rep, path, data, cast):
    w = path.name
    keys = ["id", "lang", "level", "title", "title_zh", "items"] if data.get("kind") == "announce" else ["id", "lang", "week", "day", "level", "items"]
    if not need(rep, w, data, keys):
        return
    ids = set()
    for item in data["items"]:
        iw = f"{w} {item.get('id', '?')}"
        if not need(rep, iw, item, ["id", "type", "script", "options", "answer", "explain_zh"]):
            continue
        if item["id"] in ids:
            rep.err(iw, "item id 重複")
        ids.add(item["id"])
        t = item["type"]
        if t not in DRILL_TYPES:
            rep.err(iw, f"type 不明：{t}")
        if t in {"kadai", "point", "gaiyo", "togo"}:
            if need(rep, iw, item, ["setup", "question"]):
                check_ruby(rep, f"{iw} setup", item["setup"])
                check_ruby(rep, f"{iw} question", item["question"])
        if t == "hatsuwa":
            need(rep, iw, item, ["situation_zh"])
        for j, ln in enumerate(item["script"]):
            if need(rep, f"{iw} script{j + 1}", ln, ["speaker", "text", "ruby", "zh"]):
                if ln["speaker"] not in cast:
                    rep.err(iw, f"speaker 不在 cast：{ln['speaker']}")
                check_ruby(rep, f"{iw} script{j + 1}", ln)
        for j, op in enumerate(item["options"]):
            if need(rep, f"{iw} option{j + 1}", op, ["text", "ruby", "zh"]):
                check_ruby(rep, f"{iw} option{j + 1}", op)
        check_options(rep, iw, item)


def calendar_order(f):
    """依上課順序排列：週 → 集 → 同集號時日劇（週一三五）先於動漫。"""
    m = re.search(r"w(\d+)[/\\](?:e|d)(\d+)", f.as_posix())
    week, num = (int(m.group(1)), int(m.group(2))) if m else (0, 0)
    return ("drill" in f.parts, week, num, "anime" in f.parts, f.as_posix())


def check_pron(rep, path, data):
    w = path.name
    if not need(rep, w, data, ["id", "title", "title_zh", "items"]):
        return
    ids = set()
    for item in data["items"]:
        iw = f"{w} {item.get('id', '?')}"
        if not need(rep, iw, item, ["id", "contrast", "a", "b"]):
            continue
        if item["id"] in ids:
            rep.err(iw, "id 重複")
        ids.add(item["id"])
        for side in "ab":
            if need(rep, f"{iw} {side}", item[side], ["text", "reading", "zh"]) and not KANA_ONLY.match(item[side]["reading"]):
                rep.err(iw, f"讀音必須是假名：{item[side]['reading']}")
        if item["a"].get("reading") == item["b"].get("reading"):
            rep.err(iw, "兩個字讀音相同，聽不出差別")


def check_tales_verbatim(rep, files):
    """童話：同一篇的所有句子依序接起來，必須等於青空文庫原文（去空白與假名標記）。"""
    src_path = ROOT / "story" / "ja" / "tales" / "source.json"
    if not src_path.exists():
        return
    src = {v["title"]: re.sub(r"\s", "", re.sub(r"\{([^|}]+)\|[^}]+\}", r"\1", v["text"]))
           for v in json.loads(src_path.read_text(encoding="utf-8")).values()}
    by_title = {}
    for f in files:
        if "tales" not in f.parts or not f.name.startswith("e"):
            continue
        d = json.loads(f.read_text(encoding="utf-8"))
        by_title.setdefault(d.get("source", {}).get("title"), []).append(d)
    for title, eps in by_title.items():
        eps.sort(key=lambda d: d["episode"])
        got = re.sub(r"\s", "", "".join(l["text"] for d in eps for sc in d["scenes"] for l in sc["lines"]))
        want = re.sub(r"[一二三四五六七八九十]+", "", src.get(title, ""))
        got_n = re.sub(r"[一二三四五六七八九十]+", "", got)
        if title not in src:
            rep.err(f"童話 {title}", "source.title 對不到原文")
        elif not want.startswith(got_n):
            i = next((k for k, (a, b) in enumerate(zip(got_n, want)) if a != b), min(len(got_n), len(want)))
            rep.err(f"童話 {title}", f"和原文不同（第 {i} 字附近）：原文「{want[max(0, i - 8):i + 8]}」／劇本「{got_n[max(0, i - 8):i + 8]}」")
        elif len(got_n) < len(want):
            rep.warn(f"童話 {title}", f"目前只收錄原文的 {len(got_n)}/{len(want)} 字")


def validate(paths):
    cast = load_casts()
    rep, seen = Report(), {}
    files = []
    for p in paths:
        p = Path(p)
        files += sorted(p.glob("**/*.json")) if p.is_dir() else [p]
    files.sort(key=calendar_order)
    for f in files:
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            rep.err(f.name, f"JSON 解析失敗：{e}")
            continue
        if f.name == "index.json":
            continue
        if "pron" in f.parts:
            check_pron(rep, f, data)
            continue
        if "drill" in f.parts or "announce" in f.parts:
            check_drill(rep, f, data, cast)
        else:
            check_episode(rep, f, data, cast, seen)
    check_tales_verbatim(rep, files)
    return rep, len(files)


def main(argv):
    rep, n = validate(argv or [ROOT / "scripts"])
    for m in rep.warnings:
        print("警告", m)
    for m in rep.errors:
        print("錯誤", m)
    print(f"檢查 {n} 個檔案：錯誤 {len(rep.errors)}、警告 {len(rep.warnings)}")
    return 1 if rep.errors else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
