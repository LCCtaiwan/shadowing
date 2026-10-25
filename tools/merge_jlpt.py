#!/usr/bin/env python3
"""把 data/jlpt/nN.part*.json 合併成 nN.json，順便清理原始清單的格式問題。

用法：python3 tools/merge_jlpt.py n5 n4
- 讀音或寫法裡的括號：開頭的括號保留內容（(に) よると → によると），結尾的可省略部分去掉（スーパー (マーケット) → スーパー），「(する)」去掉。
- 少數原始資料錯誤用 FIXES 修正（寫法、讀音），id 跟著修正後的寫法；drop 表示重複寫法，直接略過。
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "data" / "jlpt"
FIXES = {
    "下る": {"text": "下がる", "reading": "さがる"},
    "お金持ち": {"reading": "おかねもち"},
    "堅": {"text": "堅い"},
    "伯父": {"reading": "おじ"},
    "落る": {"text": "落ちる"},
    "楽む": {"text": "楽しむ"},
    "答": {"text": "答え"},
    "いただく": {"reading": "いただく"},
    "終る": {"text": "終わる"},
    "曲る": {"text": "曲がる"},
    "落す": {"text": "落とす"},
    "付合う": {"text": "付き合う"},
    "釣": {"text": "釣り"},
    "年寄": {"text": "年寄り"},
    "当り": {"text": "当たり"},
    "押える": {"text": "押さえる"},
    "代る": {"text": "代わる"},
    "反る": {"reading": "そる"},
    "下す": {"text": "下ろす"},
    "清む": {"drop": True},  # 同「澄む」
    # N2
    "まるごと": {"text": "丸ごと"},
    "かさを～さす": {"text": "さす", "reading": "さす"},
    "こうようもみじ": {"text": "もみじ", "reading": "もみじ"},
    "しかくしかくい": {"text": "四角", "reading": "しかく"},
    "しつれいしました": {"text": "失礼しました"},
    "だいいち": {"text": "第一"},
    "惨めな": {"text": "惨め", "reading": "みじめ"},
    "済": {"text": "済み"},
    "付": {"text": "付き"},
    "浮ぶ": {"text": "浮かぶ"},
    "打合せ": {"text": "打ち合わせ"},
    "落着く": {"text": "落ち着く"},
    "落し物": {"text": "落とし物"},
    "思い掛けない": {"text": "思いがけない"},
    "こくせき": {"text": "国籍"},
    "タイア": {"text": "タイヤ", "reading": "タイヤ"},
    "田ぼ": {"text": "田んぼ"},
    "話中": {"text": "話し中"},
    "引受る": {"text": "引き受ける"},
    "引算": {"text": "引き算"},
    "陽射": {"text": "陽射し"},
    "人差指": {"text": "人差し指"},
    "瓶詰": {"text": "瓶詰め"},
    "目覚し": {"text": "目覚まし"},
    "レクリェーション": {"text": "レクリエーション", "reading": "レクリエーション"},
    "我": {"text": "我が"},
    "割算": {"text": "割り算"},
    "捕える": {"text": "捕らえる"},
    "振舞う": {"text": "振る舞う"},
    # N2 重複寫法（另一種寫法已在清單裡）
    "あみもの": {"drop": True},
    "売上": {"drop": True},
    "売行き": {"drop": True},
    "思いっ切り": {"drop": True},
    "かけざん": {"drop": True},
    "かしょ": {"drop": True},
    "切っ掛け": {"drop": True},
    "腰掛": {"drop": True},
    "卒直": {"drop": True},
    "適確": {"drop": True},
    "なにしろ": {"drop": True},
    "生意気な": {"drop": True},
    "なんとも": {"drop": True},
    "乗換": {"drop": True},
    "剥す": {"drop": True},
    "果して": {"drop": True},
    "話合い": {"drop": True},
    "引分け": {"drop": True},
    "日日": {"drop": True},
    "ひゃっかじてん": {"drop": True},
    "附属": {"drop": True},
    "間も無く": {"drop": True},
    "湯飲": {"drop": True},
}


def clean(s):
    s = re.sub(r"^\(([^)]*)\)\s*", r"\1", s.strip())
    s = re.sub(r"\s*\([^)]*\)\s*$", "", s)
    return re.sub(r"\s+", "", s)


def merge(level):
    parts = sorted(DIR.glob(f"{level}.part*.json")) or [DIR / f"{level}.json"]  # 沒有分檔時就重新整理已合併的檔
    if not parts[0].exists():
        raise SystemExit(f"找不到 {level}.part*.json 或 {level}.json")
    rows, seen = [], set()
    for p in parts:
        for v in json.loads(p.read_text(encoding="utf-8")):
            text, reading = clean(v["text"]), clean(v["reading"])
            fix = FIXES.get(text, {})
            if fix.get("drop"):
                continue
            text, reading = fix.get("text", text), fix.get("reading", reading)
            if fix or (text != v["text"].strip() and "(" in v.get("note_zh", "")):
                v = {k: x for k, x in v.items() if k != "note_zh"}  # 修正後原本說明 raw 錯誤的備註就不需要了
            vid = f"ja:vocab:{text}"
            if vid in seen:
                continue
            seen.add(vid)
            rows.append({**v, "id": vid, "text": text, "reading": reading})
    out = DIR / f"{level}.json"
    out.write_text(json.dumps(rows, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{out.relative_to(ROOT)}：{len(rows)} 個（來自 {len(parts)} 個分檔）")
    return parts


if __name__ == "__main__":
    for level in sys.argv[1:] or ["n5", "n4"]:
        merge(level)
