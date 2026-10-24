#!/usr/bin/env python3
"""產生 App 用的內容索引 scripts/index.json：每集、每份ドリル的上課日期、標題與檔案路徑。

劇本或課表有變動後執行：python3 tools/build_index.py
"""
import datetime as dt
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]


def build():
    plan = json.loads((ROOT / "curriculum" / "plan.json").read_text(encoding="utf-8"))
    start = dt.date.fromisoformat(plan["start_date"])

    def date_of(week, day_idx):
        return (start + dt.timedelta(days=(week - 1) * 7 + day_idx)).isoformat()

    episodes, drills = [], []
    for w in plan["weeks"]:
        for ep in w["episodes"]:
            rel = f"scripts/ja/{ep['series']}/w{w['week']:02d}/e{ep['episode']:02d}.json"
            path = ROOT / rel
            if not path.exists():
                continue
            data = json.loads(path.read_text(encoding="utf-8"))
            episodes.append({
                "id": data["id"], "series": ep["series"], "week": w["week"], "episode": ep["episode"],
                "day": ep["day"], "date": date_of(w["week"], DAYS.index(ep["day"])),
                "level": data["level"], "title": data["title"], "title_zh": data["title_zh"],
                "lines": sum(len(s["lines"]) for s in data["scenes"]),
                "path": rel, "audio": f"audio/ja/{ep['series']}/w{w['week']:02d}/e{ep['episode']:02d}",
            })
    for f in sorted((ROOT / "scripts" / "ja" / "drill").glob("w*/*.json")):
        data = json.loads(f.read_text(encoding="utf-8"))
        day = data["day"]
        drills.append({
            "id": data["id"], "week": data["week"], "day": day, "date": date_of(data["week"], day - 1),
            "kind": "mock" if f.stem == "sun" else "daily", "level": data["level"], "items": len(data["items"]),
            "path": f.relative_to(ROOT).as_posix(), "audio": f"audio/ja/drill/w{data['week']:02d}/{f.stem}",
        })
    pron = []
    for f in sorted((ROOT / "scripts" / "ja" / "pron").glob("p*.json")):
        data = json.loads(f.read_text(encoding="utf-8"))
        pron.append({"id": data["id"], "title": data["title"], "title_zh": data["title_zh"], "tip_zh": data.get("tip_zh", ""),
                     "items": len(data["items"]), "path": f.relative_to(ROOT).as_posix(), "audio": f"audio/ja/pron/{f.stem}"})
    episodes.sort(key=lambda e: e["date"])
    drills.sort(key=lambda d: d["date"])
    return {
        "start_date": plan["start_date"], "exam_targets": plan["exam_targets"], "phases": plan["phases"],
        "series": plan.get("series", []), "episodes": episodes, "drills": drills, "pron": pron,
    }


def main():
    index = build()
    out = ROOT / "scripts" / "index.json"
    out.write_text(json.dumps(index, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"已寫入 {out.relative_to(ROOT)}：{len(index['episodes'])} 集、{len(index['drills'])} 份聽力練習、{len(index['pron'])} 組發音")


if __name__ == "__main__":
    main()
