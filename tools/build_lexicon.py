#!/usr/bin/env python3
"""從所有劇本彙整已教過的單字、片語、文法，寫入 story/ja/lexicon.json。

Claude 寫下一週劇本前先跑這支，避免重複新教，並挑舊詞做螺旋複習。
用法：python3 tools/build_lexicon.py
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "story" / "ja" / "lexicon.json"


def main():
    lex = {"vocab": {}, "phrases": {}, "grammar": {}}
    for f in sorted((ROOT / "scripts" / "ja").glob("*/w*/e*.json")):
        ep = json.loads(f.read_text(encoding="utf-8"))
        where = f"{ep['series']}-w{ep['week']:02d}-e{ep['episode']:02d}"
        for v in ep["vocab"]:
            entry = lex["vocab"].setdefault(v["id"], {
                "text": v["text"], "reading": v["reading"], "zh": v["zh"], "pos": v.get("pos", ""), "level": v["level"],
                "introduced": where, "used_in": []})
            entry["used_in"].append(where)
            if v.get("links") and not entry.get("links"):
                entry["links"] = v["links"]
        for p in ep["phrases"]:
            entry = lex["phrases"].setdefault(p["id"], {"text": p["text"], "zh": p["zh"], "introduced": where, "used_in": []})
            entry["used_in"].append(where)
        for g in ep["grammar"]:
            entry = lex["grammar"].setdefault(g["id"], {
                "pattern": g["pattern"], "zh": g["zh"], "level": g["level"], "introduced": where, "used_in": []})
            entry["used_in"].append(where)
    OUT.write_text(json.dumps(lex, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    counts = {k: len(v) for k, v in lex.items()}
    by_level = {}
    for v in lex["vocab"].values():
        by_level[v["level"]] = by_level.get(v["level"], 0) + 1
    print(f"已寫入 {OUT.relative_to(ROOT)}：{counts}；單字級別分布 {dict(sorted(by_level.items()))}")


if __name__ == "__main__":
    main()
