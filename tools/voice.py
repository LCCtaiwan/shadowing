#!/usr/bin/env python3
"""把劇本與聽解ドリル逐句送 Gemini TTS，輸出 mp3 與 manifest.json。

用法：
  .venv/bin/python tools/voice.py scripts/ja/drama/w01/e01.json     # 指定檔案或資料夾
  .venv/bin/python tools/voice.py --for-date 2026-10-26               # 依課表配那天要用的內容
  .venv/bin/python tools/voice.py --for-date tomorrow --dry-run        # 只列出要送的文字，不呼叫 API

金鑰：環境變數 GEMINI_API_KEY。型號：GEMINI_TTS_MODEL（預設 gemini-3.8-flash-tts）。
輸出：audio/ja/<series>/wNN/eNN/ 與 audio/ja/drill/wNN/dN/，每個資料夾一份 manifest.json。
同一段的文字、聲音、語氣、型號都沒變就跳過，所以可以重複執行。
"""
import argparse
import base64
import datetime as dt
import hashlib
import json
import os
import re
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AUDIO = ROOT / "audio"
DEFAULT_MODEL = "gemini-3.8-flash-tts"
PACE = {
    "N5": "学習者向けに、ゆっくり、はっきり話す。",
    "N4": "少しゆっくり、でも自然に話す。",
    "N3": "自然な速さで話す。",
    "N2": "自然な速さで、会話らしく話す。",
    "N1": "ネイティブ同士の自然な速さで話す。",
}
DIGIT_OR_LATIN = re.compile(r"[0-9０-９A-Za-zＡ-Ｚａ-ｚ]")


# ---------- TTS 用文字 ----------

def _tagger():
    try:
        import fugashi
        return fugashi.Tagger()
    except Exception:  # 沒裝斷詞器時，退回只替換數字與英文字母
        return None


TAGGER = _tagger()


def _hira(s):
    return "".join(chr(ord(c) - 0x60) if "ァ" <= c <= "ヶ" else c for c in s)


def _token_spans(text):
    """回傳 [(start, end, 讀音平假名)]；斷詞器不可用時回傳 None。"""
    if TAGGER is None:
        return None
    spans, pos = [], 0
    for w in TAGGER(text):
        start = text.find(w.surface, pos)
        if start < 0:
            return None
        end = start + len(w.surface)
        kana = getattr(w.feature, "kana", None)
        spans.append((start, end, _hira(kana) if kana and kana != "*" else w.surface))
        pos = end
    return spans


KANA = re.compile(r"[^ぁ-ゖー]")


def tts_text(ruby):
    """把 ruby 片段組成送給 TTS 的文字。

    含數字／英文字母的片段，以及斷詞器讀法與 ruby 不同的片段，改送假名，
    避免 TTS 把 七時 唸成 ななじ、小雨 唸成 こさめ。其他維持漢字，保留自然的重音。
    比對單位：漢字片段不可拆、假名逐字可拆；在 ruby 與斷詞結果都有邊界的位置切成視窗逐一比較。
    """
    units, pos = [], 0  # (start, end, 原文, 讀音, 是否為漢字片段)
    for seg in ruby:
        if len(seg) == 2:
            units.append((pos, pos + len(seg[0]), seg[0], seg[1], True))
            pos += len(seg[0])
        else:
            for ch in seg[0]:
                units.append((pos, pos + 1, ch, ch, False))
                pos += 1
    text = "".join(u[2] for u in units)
    spans = _token_spans(text)
    use_reading = [u[4] and bool(DIGIT_OR_LATIN.search(u[2])) for u in units]
    if spans is not None:
        common = sorted({u[0] for u in units} & {s[0] for s in spans} | {len(text)})
        for a, b in zip(common, common[1:]):
            in_units = [i for i, u in enumerate(units) if a <= u[0] < b]
            mine = KANA.sub("", _hira("".join(units[i][3] for i in in_units)))
            theirs = KANA.sub("", "".join(s[2] for s in spans if a <= s[0] < b))
            if mine != theirs:
                for i in in_units:
                    use_reading[i] = use_reading[i] or units[i][4]
    return "".join(u[3] if use_reading[i] else u[2] for i, u in enumerate(units))


# ---------- 工作清單 ----------

def load_cast():
    cast = {}
    for p in sorted((ROOT / "story" / "ja").glob("**/cast.json")):
        cast.update(json.loads(p.read_text(encoding="utf-8")))
    return cast


def style_for(cast, speaker, level, extra=None):
    parts = [f"話し方：{cast[speaker]['style']}。", PACE.get(level, PACE["N3"])]
    if extra:
        parts.append(f"この台詞は「{extra}」。")
    return " ".join(parts)


def episode_jobs(path, data, cast):
    """一集要配的所有片段：前情提要、每句台詞、文法例句、單字。"""
    lvl = data["level"]
    out_dir = AUDIO / "ja" / data["series"] / f"w{data['week']:02d}" / f"e{data['episode']:02d}"
    jobs = [dict(key="recap", text=tts_text(data["recap"]["ruby"]), voice=cast["narrator"]["voice"],
                 style=style_for(cast, "narrator", lvl))]
    for sc in data["scenes"]:
        for ln in sc["lines"]:
            jobs.append(dict(key=ln["id"], text=tts_text(ln["ruby"]), voice=cast[ln["speaker"]]["voice"],
                             style=style_for(cast, ln["speaker"], lvl, ln.get("style"))))
    for gi, g in enumerate(data["grammar"], 1):
        for ei, ex in enumerate(g["examples"], 1):
            jobs.append(dict(key=f"g{gi}-ex{ei}", text=tts_text(ex["ruby"]), voice=cast["woman"]["voice"],
                             style=style_for(cast, "woman", lvl)))
    for v in data["vocab"]:
        if v.get("review"):
            continue
        jobs.append(dict(key=v["id"], text=v["reading"], voice=cast["narrator"]["voice"],
                         style="単語をひとつだけ、辞書の発音のように、はっきり読む。"))
    return out_dir, jobs


def drill_jobs(path, data, cast):
    lvl = data["level"]
    name = path.stem
    out_dir = AUDIO / "ja" / "drill" / f"w{data['week']:02d}" / name
    jobs = []
    for item in data["items"]:
        iid = item["id"]
        if "setup" in item:
            jobs.append(dict(key=f"{iid}-setup", text=tts_text(item["setup"]["ruby"]),
                             voice=cast["narrator"]["voice"], style=style_for(cast, "narrator", lvl)))
        if "question" in item:
            jobs.append(dict(key=f"{iid}-question", text=tts_text(item["question"]["ruby"]),
                             voice=cast["narrator"]["voice"], style=style_for(cast, "narrator", lvl)))
        speakers = []
        for j, ln in enumerate(item["script"], 1):
            speakers.append(ln["speaker"])
            jobs.append(dict(key=f"{iid}-s{j}", text=tts_text(ln["ruby"]), voice=cast[ln["speaker"]]["voice"],
                             style=style_for(cast, ln["speaker"], lvl, ln.get("style"))))
        if item["type"] in {"sokuji", "hatsuwa"}:  # 選項只用聽的，由「回應的人」唸
            responder = "woman" if speakers and speakers[-1] == "man" else "man"
            for k, op in enumerate(item["options"], 1):
                jobs.append(dict(key=f"{iid}-o{k}", text=tts_text(op["ruby"]), voice=cast[responder]["voice"],
                                 style=style_for(cast, responder, lvl)))
    return out_dir, jobs


def jobs_for(path, cast):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    return (drill_jobs if "drill" in Path(path).parts else episode_jobs)(Path(path), data, cast)


def files_for_date(day):
    """依 curriculum/plan.json 找出某天要用的劇本與ドリル。"""
    plan = json.loads((ROOT / "curriculum" / "plan.json").read_text(encoding="utf-8"))
    start = dt.date.fromisoformat(plan["start_date"])
    offset = (day - start).days
    if offset < 0:
        return []
    week, weekday = offset // 7 + 1, day.weekday()  # 0 = 週一
    drill_dir = ROOT / "scripts" / "ja" / "drill" / f"w{week:02d}"
    if weekday == 6:
        return [p for p in [drill_dir / "sun.json"] if p.exists()]
    key = ["mon", "tue", "wed", "thu", "fri", "sat"][weekday]
    files = []
    for w in plan["weeks"]:
        if w["week"] != week:
            continue
        for ep in w["episodes"]:
            if ep["day"] == key:
                files.append(ROOT / "scripts" / "ja" / ep["series"] / f"w{week:02d}" / f"e{ep['episode']:02d}.json")
    files.append(drill_dir / f"d{weekday + 1}.json")
    return [p for p in files if p.exists()]


# ---------- 呼叫 Gemini ----------

def job_hash(job, model):
    raw = json.dumps([job["text"], job["voice"], job["style"], model], ensure_ascii=False)
    return hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]


def safe_name(key):
    if re.fullmatch(r"[A-Za-z0-9_.-]+", key):
        return key
    return "v-" + hashlib.sha1(key.encode("utf-8")).hexdigest()[:12]


def make_synth(model):
    from google import genai

    client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

    def synth(job):
        interaction = client.interactions.create(
            model=model,
            input=[{"type": "user_input", "content": [{
                "type": "text", "text": job["text"],
                "annotations": [{"type": "speech_metadata", "style": job["style"]}],
            }]}],
            response_format={"type": "audio", "mime_type": "audio/mp3"},
            generation_config={"speech_config": [{"voice": job["voice"], "language": "ja"}]},
        )
        data = interaction.output_audio.data
        return base64.b64decode(data) if isinstance(data, str) else bytes(data)

    return synth


def with_retry(synth, job, tries=5):
    for attempt in range(tries):
        try:
            return synth(job)
        except Exception as e:  # 429／5xx 等暫時性錯誤：指數退避
            if attempt == tries - 1:
                raise
            wait = 2 ** attempt * 5
            print(f"  重試 {job['key']}（{type(e).__name__}: {str(e)[:120]}），{wait} 秒後")
            time.sleep(wait)


def voice_dir(out_dir, jobs, synth, model, rpm=10, force=False, dry_run=False):
    """配一個資料夾；回傳 (新配, 跳過)。manifest 記錄每段的檔名、文字與雜湊。"""
    manifest_path = out_dir / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}
    made = skipped = 0
    for job in jobs:
        h = job_hash(job, model)
        fname = safe_name(job["key"]) + ".mp3"
        old = manifest.get(job["key"])
        if not force and old and old["hash"] == h and (out_dir / old["file"]).exists():
            skipped += 1
            continue
        if dry_run:
            print(f"  [{job['voice']}] {job['key']}: {job['text']}")
            made += 1
            continue
        audio = with_retry(synth, job)
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / fname).write_bytes(audio)
        manifest[job["key"]] = {"file": fname, "hash": h, "text": job["text"], "voice": job["voice"]}
        manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        made += 1
        if rpm:
            time.sleep(60 / rpm)
    return made, skipped


def load_dotenv():
    """環境變數沒設時，讀專案根目錄的 .env（由 tools/setup_key.py 建立）。"""
    env = ROOT / ".env"
    if not env.exists():
        return
    for line in env.read_text(encoding="utf-8").splitlines():
        k, sep, v = line.partition("=")
        if sep and k.strip() and k.strip() not in os.environ:
            os.environ[k.strip()] = v.strip()


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("paths", nargs="*")
    ap.add_argument("--for-date", help="YYYY-MM-DD、today 或 tomorrow")
    ap.add_argument("--dry-run", action="store_true", help="只列出要送的文字")
    ap.add_argument("--force", action="store_true", help="全部重配")
    ap.add_argument("--rpm", type=float, default=10, help="每分鐘最多呼叫次數（預設 10）")
    ap.add_argument("--limit", type=int, help="每個檔案最多配幾段（試聽用）")
    args = ap.parse_args(argv)

    files = [Path(p) for p in args.paths]
    if args.for_date:
        today = dt.date.today()
        day = {"today": today, "tomorrow": today + dt.timedelta(days=1)}.get(args.for_date) \
            or dt.date.fromisoformat(args.for_date)
        files += files_for_date(day)
        print(f"{day}：{[str(f.relative_to(ROOT)) for f in files_for_date(day)] or '沒有排課'}")
    expanded = []
    for p in files:
        expanded += sorted(p.glob("**/*.json")) if p.is_dir() else [p]
    if not expanded:
        ap.error("沒有要配音的檔案")

    load_dotenv()
    model = os.environ.get("GEMINI_TTS_MODEL") or DEFAULT_MODEL
    if not args.dry_run and not os.environ.get("GEMINI_API_KEY"):
        sys.exit("找不到 GEMINI_API_KEY：請執行 .venv/bin/python tools/setup_key.py，或設定環境變數（--dry-run 可只看要送的文字）")
    synth = None if args.dry_run else make_synth(model)
    cast = load_cast()
    total_made = total_skipped = 0
    for f in expanded:
        out_dir, jobs = jobs_for(f, cast)
        if args.limit:
            jobs = jobs[:args.limit]
        print(f"{f.relative_to(ROOT) if f.is_absolute() else f} → {out_dir.relative_to(ROOT)}（{len(jobs)} 段）")
        made, skipped = voice_dir(out_dir, jobs, synth, model, args.rpm, args.force, args.dry_run)
        total_made += made
        total_skipped += skipped
    verb = "將配" if args.dry_run else "新配"
    print(f"完成：{verb} {total_made} 段、跳過 {total_skipped} 段（型號 {model}）")


if __name__ == "__main__":
    main(sys.argv[1:])
