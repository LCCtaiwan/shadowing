#!/usr/bin/env python3
"""用斷詞器（fugashi + unidic-lite）比對 ruby 讀音，列出可能標錯的句子。

用法：.venv/bin/python tools/check_readings.py [檔案或資料夾 ...]（預設 scripts/）
斷詞器本身也會錯（何＝なに／なん、數字、專有名詞），所以結果只是「請人工確認」的清單。
"""
import json
import re
import sys
from pathlib import Path

import fugashi

ROOT = Path(__file__).resolve().parent.parent
TAGGER = fugashi.Tagger()
NON_KANA = re.compile(r"[^ぁ-ゖー]")


def hira(s):
    return "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in s)


def norm(s):
    return NON_KANA.sub("", hira(s))


def ruby_reading(ruby):
    return norm("".join(seg[1] if len(seg) == 2 else seg[0] for seg in ruby))


def tagger_reading(text):
    out = []
    for w in TAGGER(text):
        kana = getattr(w.feature, "kana", None)
        out.append(kana if kana and kana != "*" else w.surface)
    return norm("".join(out))


def walk(obj, where):
    if isinstance(obj, dict):
        if isinstance(obj.get("text"), str) and isinstance(obj.get("ruby"), list):
            yield where, obj
        for k, v in obj.items():
            yield from walk(v, f"{where}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            yield from walk(v, f"{where}[{i}]")


def main(argv):
    paths = [Path(p) for p in argv] or [ROOT / "scripts"]
    files = [f for p in paths for f in (sorted(p.glob("**/*.json")) if p.is_dir() else [p])]
    flagged = total = 0
    for f in files:
        data = json.loads(f.read_text(encoding="utf-8"))
        for where, obj in walk(data, f.name):
            try:
                mine = ruby_reading(obj["ruby"])
            except (IndexError, TypeError):
                continue
            total += 1
            theirs = tagger_reading(obj["text"])
            if mine != theirs:
                flagged += 1
                print(f"{where}\n  句子：{obj['text']}\n  ruby：{mine}\n  斷詞：{theirs}")
    print(f"比對 {total} 句，{flagged} 句讀音不一致（請人工確認）")


if __name__ == "__main__":
    main(sys.argv[1:])
