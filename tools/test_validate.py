import copy
import json

import validate


def line(i, text, ruby, speaker="yuxiang"):
    return {"id": f"s1-{i:02d}", "speaker": speaker, "text": text, "ruby": ruby, "zh": "中文"}


def episode():
    lines = [line(i, "はい、お願いします。", [["はい、お"], ["願", "ねが"], ["いします。"]]) for i in range(1, 19)]
    lines[0] = line(1, "パスポートを見せてください。", [["パスポートを"], ["見", "み"], ["せてください。"]], "officer")
    ex = {"text": "ここに書いてください。", "ruby": [["ここに"], ["書", "か"], ["いてください。"]], "zh": "請寫在這裡。"}
    return {
        "id": "ja-drama-w01-e01", "lang": "ja", "series": "drama", "week": 1, "episode": 1, "level": "N5",
        "title": "成田空港", "title_zh": "成田機場",
        "recap": {"text": "日本に着いた。", "ruby": [["日本", "にほん"], ["に"], ["着", "つ"], ["いた。"]], "zh": "到日本了。"},
        "focus": {"title": "てください", "zh": "注意聽請求句。"},
        "scenes": [{"id": "s1", "lines": lines}],
        "vocab": [{"id": "ja:vocab:見せる", "text": "見せる", "reading": "みせる", "pos": "動詞", "zh": "給人看", "level": "N4", "line": "s1-01"}],
        "phrases": [{"id": "ja:phrase:お願いします", "text": "お願いします", "surface": "お願いします", "zh": "麻煩了", "line": "s1-02"}],
        "grammar": [
            {"id": "ja:grammar:te-kudasai", "pattern": "〜てください", "zh": "請～", "level": "N5", "line": "s1-01", "surface": "見せてください", "examples": [ex, ex]},
            {"id": "ja:grammar:masu", "pattern": "〜ます", "zh": "禮貌形", "level": "N5", "line": "s1-02", "surface": "します", "examples": [ex, ex]},
        ],
        "questions": [{"q": "何を見せますか。", "q_zh": "要給看什麼？", "options": ["a", "b", "c"], "answer": 0}],
    }


def run(tmp_path, data):
    p = tmp_path / "e01.json"
    p.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    rep, _ = validate.validate([p])
    return rep


def test_valid_episode_passes(tmp_path):
    assert run(tmp_path, episode()).errors == []


def test_ruby_must_match_text(tmp_path):
    data = episode()
    data["scenes"][0]["lines"][0]["ruby"] = [["パスポートを"], ["見", "み"], ["せて。"]]
    assert any("ruby 拼起來" in e for e in run(tmp_path, data).errors)


def test_kanji_without_reading_is_error(tmp_path):
    data = episode()
    data["scenes"][0]["lines"][0]["ruby"] = [["パスポートを見せてください。"]]
    assert any("沒有讀音" in e for e in run(tmp_path, data).errors)


def test_unknown_speaker_and_bad_surface(tmp_path):
    data = episode()
    data["scenes"][0]["lines"][1]["speaker"] = "nobody"
    data["phrases"][0]["surface"] = "ありがとう"
    errs = run(tmp_path, data).errors
    assert any("speaker 不在 cast" in e for e in errs)
    assert any("surface 不在句中" in e for e in errs)


def test_repeated_vocab_warns_unless_review(tmp_path):
    a, b = episode(), copy.deepcopy(episode())
    b["id"] = "ja-drama-w01-e02"
    (tmp_path / "e01.json").write_text(json.dumps(a, ensure_ascii=False), encoding="utf-8")
    (tmp_path / "e02.json").write_text(json.dumps(b, ensure_ascii=False), encoding="utf-8")
    rep, _ = validate.validate([tmp_path])
    assert any("已在" in w for w in rep.warnings)
    b["vocab"][0]["review"] = True
    (tmp_path / "e02.json").write_text(json.dumps(b, ensure_ascii=False), encoding="utf-8")
    rep, _ = validate.validate([tmp_path])
    assert not any("已在" in w for w in rep.warnings)
