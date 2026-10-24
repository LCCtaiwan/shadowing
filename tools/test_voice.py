import datetime as dt
import json

import voice


def test_tts_text_keeps_kanji_when_reading_is_standard():
    assert voice.tts_text([["お"], ["弁当", "べんとう"], ["、"], ["温", "あたた"], ["めますか？"]]) == "お弁当、温めますか？"
    assert voice.tts_text([["パスポートを"], ["見", "み"], ["せてください。"]]) == "パスポートを見せてください。"


def test_tts_text_switches_to_kana_for_risky_readings():
    assert voice.tts_text([["小雨", "シャオユー"], ["です。"]]) == "シャオユーです。"
    assert voice.tts_text([["七時", "しちじ"], ["に"], ["起", "お"], ["きます。"]]) == "しちじに起きます。"
    assert voice.tts_text([["十分", "じゅっぷん"], ["かかります。"]]) == "じゅっぷんかかります。"


def test_tts_text_digits_and_latin_always_kana():
    assert voice.tts_text([["3", "さん"], ["番線", "ばんせん"], ["です。"]]).startswith("さん")
    assert voice.tts_text([["Suica", "スイカ"], ["で"]]) == "スイカで"


def test_files_for_date_follows_plan():
    names = lambda d: [p.relative_to(voice.ROOT).as_posix() for p in voice.files_for_date(d)]
    assert names(dt.date(2026, 10, 26)) == ["scripts/ja/drama/w01/e01.json", "scripts/ja/family/w01/e01.json", "scripts/ja/drill/w01/d1.json"]
    assert names(dt.date(2026, 10, 27)) == ["scripts/ja/anime/w01/e01.json", "scripts/ja/kids/w01/e01.json", "scripts/ja/drill/w01/d2.json"]
    assert names(dt.date(2026, 11, 1)) == ["scripts/ja/drill/w01/sun.json"]
    assert names(dt.date(2026, 11, 2)) == ["scripts/ja/drama/w02/e04.json", "scripts/ja/family/w02/e04.json", "scripts/ja/drill/w02/d1.json"]
    assert names(dt.date(2026, 10, 25)) == []


def test_episode_jobs_cover_lines_examples_and_new_vocab():
    cast = voice.load_cast()
    path = voice.ROOT / "scripts/ja/drama/w01/e01.json"
    data = json.loads(path.read_text(encoding="utf-8"))
    _, jobs = voice.jobs_for(path, cast)
    keys = {j["key"] for j in jobs}
    lines = [ln["id"] for sc in data["scenes"] for ln in sc["lines"]]
    assert "recap" in keys and set(lines) <= keys and {"g1-ex1", "g2-ex2"} <= keys
    assert {v["id"] for v in data["vocab"] if not v.get("review")} <= keys


def test_sokuji_options_are_voiced_by_responder():
    cast = voice.load_cast()
    _, jobs = voice.jobs_for(voice.ROOT / "scripts/ja/drill/w01/d1.json", cast)
    assert any(j["key"].endswith("-o1") for j in jobs)


def test_voice_dir_skips_unchanged_and_redoes_changed(tmp_path):
    calls = []
    synth = lambda job: calls.append(job["key"]) or b"ID3fake"
    jobs = [dict(key="s1-01", text="こんにちは", voice="Kore", style="x"),
            dict(key="ja:vocab:駅", text="えき", voice="Kore", style="x")]
    assert voice.voice_dir(tmp_path, jobs, synth, "m", rpm=0) == (2, 0)
    assert voice.voice_dir(tmp_path, jobs, synth, "m", rpm=0) == (0, 2)
    jobs[0]["text"] = "こんばんは"
    assert voice.voice_dir(tmp_path, jobs, synth, "m", rpm=0) == (1, 1)
    manifest = json.loads((tmp_path / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["s1-01"]["file"] == "s1-01.mp3"
    assert manifest["ja:vocab:駅"]["file"].startswith("v-")
    assert calls == ["s1-01", "ja:vocab:駅", "s1-01"]


def test_make_units_groups_only_batchable_same_voice():
    j = lambda k, v="A", b=True, t="あ": (dict(key=k, text=t, voice=v, style="s", batch=b), "h")
    units = voice.make_units([j("1"), j("2"), j("3", v="B"), j("4", b=False), j("5"), j("6")])
    assert [[x[0]["key"] for x in u] for u in units] == [["1", "2"], ["3"], ["4"], ["5", "6"]]
    many = [j(str(i)) for i in range(20)]
    assert all(len(u) <= voice.BATCH_MAX_ITEMS for u in voice.make_units(many))


def test_split_audio_cuts_at_long_pauses(tmp_path):
    import shutil
    import subprocess
    if not shutil.which("ffmpeg"):
        return
    # 三段聲音，中間各隔 0.8 秒靜音；第二段內部有 0.1 秒的小停頓（不該被切開）
    expr = ("sine=f=440:d=0.6[a];anullsrc=r=24000:cl=mono:d=0.8[s1];sine=f=550:d=0.4[b1];anullsrc=r=24000:cl=mono:d=0.1[g];"
            "sine=f=550:d=0.4[b2];anullsrc=r=24000:cl=mono:d=0.8[s2];sine=f=660:d=0.5[c];"
            "[a][s1][b1][g][b2][s2][c]concat=n=7:v=0:a=1")
    out = tmp_path / "t.mp3"
    subprocess.run(["ffmpeg", "-loglevel", "error", "-f", "lavfi", "-i", "anullsrc=r=24000:cl=mono:d=0.01",
                    "-filter_complex", expr, "-ar", "24000", "-ac", "1", str(out)], check=True)
    segs = voice.split_audio(out.read_bytes(), 3)
    assert segs is not None and len(segs) == 3
    assert voice.split_audio(out.read_bytes(), 6) is None
