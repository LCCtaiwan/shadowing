# 劇本撰寫規格（Claude 寫課用）

本文件給撰寫劇本的 Claude（本機或每週雲端例行工作）使用。寫完一律執行：

```bash
python3 tools/validate.py
.venv/bin/python tools/check_readings.py   # 用斷詞器比對假名讀音
```

## 共通原則
- **全部原創**。不得抄錄或改寫市售教材、JLPT 真題、公式問題集、動漫或日劇台詞。
- 中文一律用**台灣繁體中文**與台灣慣用語（例：計程車、便當、捷運、悠遊卡）。
- 日語要自然、像真人會說的話；店員、站員用真實的接客用語。
- 程度控制：只用本集 `level` 以下的文法；生詞（高於目前級別的詞）不超過全集詞數的 5%，非用不可時列入 `vocab` 並在中文註明。
- 每集要**重用**前幾集教過的單字與文法（螺旋複習），重用的單字若再列入 `vocab` 要加 `"review": true`。
- 角色說話方式依 `story/ja/<series>/bible.md` 與 `cast.json`，前後一致。

## 假名（ruby）規則
- `ruby` 是片段陣列：`["假名或標點"]` 或 `["漢字", "讀音"]`。所有片段的第一個元素依序接起來必須**完全等於** `text`。
- 讀音只標在漢字部分，送り仮名放在片段外：`["温", "あたた"], ["めますか？"]`。
- 熟語整個標：`["大丈夫", "だいじょうぶ"]`；數字＋量詞整串標讀音（含音便）：`["六百八十円", "ろっぴゃくはちじゅうえん"]`。
- 用阿拉伯數字時一樣要標讀音：`["3", "さん"], ["番線", "ばんせん"]`；英文字母或品牌照樣標：`["Suica", "スイカ"]`。
- 讀音全部用平假名（外來語的片假名照原樣）。特殊讀音（今日、一人、二十歳）照實際唸法。

## 劇本 JSON（`scripts/ja/<series>/wNN/eNN.json`）
```json
{
  "id": "ja-drama-w01-e01",
  "lang": "ja", "series": "drama", "week": 1, "episode": 1, "level": "N5",
  "title": "成田空港・入国審査", "title_zh": "成田機場・入境審查",
  "recap": { "text": "…", "ruby": [["…"]], "zh": "…" },
  "focus": { "title": "聽力重點標題", "zh": "這集要特別注意聽什麼（1–2 句）" },
  "scenes": [
    { "id": "s1", "kind": "scene", "setting_zh": "成田機場入境櫃台",
      "lines": [
        { "id": "s1-01", "speaker": "officer", "text": "パスポートを見せてください。",
          "ruby": [["パスポートを"], ["見", "み"], ["せてください。"]],
          "zh": "請出示護照。", "focus": ["見せてください"], "style": "事務的、ゆっくり" }
      ] }
  ],
  "vocab": [ { "id": "ja:vocab:入国", "text": "入国", "reading": "にゅうこく", "pos": "名詞", "zh": "入境", "level": "N3", "line": "s1-02", "surface": "入国" } ],
  "phrases": [ { "id": "ja:phrase:見せてください", "text": "見せてください", "surface": "見せてください", "zh": "請給我看", "line": "s1-01" } ],
  "grammar": [
    { "id": "ja:grammar:te-kudasai", "pattern": "〜てください", "zh": "請～（請求、指示）", "level": "N5",
      "line": "s1-01", "surface": "見せてください",
      "examples": [ { "text": "…", "ruby": [["…"]], "zh": "…" }, { "text": "…", "ruby": [["…"]], "zh": "…" } ] }
  ],
  "questions": [ { "q": "日語問題", "q_zh": "中文問題", "options": ["…", "…", "…"], "answer": 1 } ]
}
```

欄位說明：
- `recap`：前情提要，日語 1–2 句（本集程度），第 1 集寫故事開場。
- `scenes`：2–3 個；動漫從第 3 集起最後一場可為 `"kind": "radio"`（廣播劇）。每集合計 **18–30 句**。
- `speaker`：必須是 `story/ja/**/cast.json` 裡的 id。旁白用 `narrator`。
- `focus`（句子內）：本集重點字句，必須是 `text` 的子字串；全集約 4–8 處。
- `style`（選填）：給 TTS 的語氣提示，例：「慌てて、早口」「棒読みっぽく」「魔王らしく低く」。
- `card`（選填，預設 true）：此句是否做成句子聽力卡；寒暄重複的句子可設 false。
- `vocab`：約 15–20 個；`text` 用辭書形；`surface`（選填）是句中實際出現的形式；`level` 用 N5–N1 估計。
- `phrases`：4–6 個實用片語；`surface` 必須是句中子字串（做填空卡）。
- `grammar`：**正好 2 個**，依 `curriculum/plan.json` 指定；`surface` 是句中體現該文法的部分；另附 2 個新例句（不可與劇中句子相同）。
- `questions`：2 題理解題（盲聽後作答），3 個選項，日語出題，附中文。

ID 慣例：`ja:vocab:<辭書形>`、`ja:phrase:<片語>`、`ja:grammar:<羅馬字-連字號>`（例：`te-kudasai`、`kara-riyuu`、`ni-narimasu`）。同一個詞或文法在不同集要用同一個 id。

## 聽解ドリル JSON（`scripts/ja/drill/wNN/dN.json`，週日模擬為 `sun.json`）
每天（d1–d6）：**即時応答 6 題＋其他題型 2 題**（N5/N4 期用 課題理解、ポイント理解、発話表現 輪替）。週日 `sun.json`：即時応答 6、課題理解 2、ポイント理解 2、発話表現 2，共 12 題。

```json
{
  "id": "ja-drill-w01-d1", "lang": "ja", "week": 1, "day": 1, "level": "N5",
  "items": [
    { "id": "w01d1-01", "type": "sokuji",
      "script": [ { "speaker": "woman", "text": "…", "ruby": [["…"]], "zh": "…" } ],
      "options": [ { "text": "…", "ruby": [["…"]], "zh": "…" }, { … }, { … } ],
      "answer": 0, "explain_zh": "為什麼是這個答案、其他選項錯在哪" },
    { "id": "w01d1-07", "type": "kadai",
      "setup": { "text": "男の人と女の人が話しています。男の人はこれから何をしますか。", "ruby": [["…"]], "zh": "…" },
      "question": { "text": "男の人はこれから何をしますか。", "ruby": [["…"]], "zh": "…" },
      "script": [ …4–10 句對話… ],
      "options": [ …4 個… ], "answer": 2, "explain_zh": "…" },
    { "id": "w01d1-08", "type": "hatsuwa", "situation_zh": "你在餐廳想加點水。你要說什麼？",
      "script": [ { "speaker": "narrator", "text": "レストランで水がほしいです。何と言いますか。", "ruby": [["…"]], "zh": "…" } ],
      "options": [ …3 個… ], "answer": 1, "explain_zh": "…" }
  ]
}
```

題型規則（模仿 JLPT 形式，內容原創）：
- `sokuji` 即時応答：一句話＋3 個回應，選項只用聽的。錯誤選項要有「聽起來像但不對」的陷阱（授受方向、時態、肯否混淆、敬語誤用）。
- `kadai` 課題理解：先唸 setup（含問題），再播對話，最後再唸一次 question；4 個選項（印在畫面上）。問「接下來要做什麼／先做什麼」。
- `point` ポイント理解：同上，但問理由、細節（為什麼、哪一個、幾點）。
- `hatsuwa` 発話表現：以 `situation_zh` 描述情境（取代插圖），narrator 唸日語情境句；3 個選項是「這時該說的話」。
- `gaiyo`／`togo`：N3、N2 期才用。
- 對話角色可用 `man`、`woman`、`narrator`，也可用兩部劇的角色（熟悉的聲音）。
- 題目主題配合當週劇集情境與文法，讓學到的東西馬上被考到。
