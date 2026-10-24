# develog — 日語跟讀 App

## Current Goal
手機用的日語 shadowing App：Claude 寫長篇連續劇課程（旅行日劇《終電のあとで》＋動漫《放課後ラジオ部》），Gemini API 配音，Anki 式（FSRS）複習句子／單字／片語／文法。
目標：旅行聽得懂、看日劇／動漫聽得懂，並**依 JLPT 路線從 N5 進步到 N2～N1**。英語《Open Return》為第二期。

## Stack And Run Commands
- 前端：原生 HTML/CSS/JS（ES modules）PWA，無 build；`app/`
- 內容工具：Python 3（`tools/validate.py`、`tools/voice.py`），ffmpeg
- 配音：Gemini TTS（金鑰放 GitHub Secrets；本機用環境變數 `GEMINI_API_KEY`）
- 部署：GitHub Pages ＋ GitHub Actions（每日配音）；Claude 每週雲端例行工作寫劇本
- 指令（實作後補齊）：
  - 本機預覽：`python3 -m http.server 8765` → http://localhost:8765/?today=2026-10-28
  - 產生索引：`python3 tools/build_index.py`
  - 建環境：`python3 -m venv .venv && .venv/bin/pip install pytest fugashi unidic-lite`
  - 驗證劇本：`python3 tools/validate.py`；讀音比對：`.venv/bin/python tools/check_readings.py`
  - 更新 lexicon：`python3 tools/build_lexicon.py`
  - 配音：`export GEMINI_API_KEY=...` 後 `.venv/bin/python tools/voice.py <檔案> [--limit 3] [--dry-run]`；依日期：`--for-date tomorrow`
  - 套件：`.venv/bin/pip install -r tools/requirements.txt`
  - 測試：`.venv/bin/python -m pytest tools/`、`node --test tests/*.test.js`

## Brainstorming Summary
- 手機為主；日語會五十音；每天 20–30 分鐘。
- 長時間跟讀 → 長篇連續劇；兩種類型：旅行日劇、動漫（每集後段為廣播劇，輪換奇幻／推理／戀愛／熱血）。
- 週一三五日劇、週二四六動漫、週日總複習。
- UI：乾淨不套主題；日語朱紅、英語青綠；動漫標籤紫。
- 新增目標（2026-10-23）：調查 JLPT N4～N1 考試內容與教材，課程進程對齊 JLPT，目標 N2～N1。

## SDD
完整設計見 [sdd.md](sdd.md)。

## Important Project Rules
- 不複製市售教材或 JLPT 考題原文；只參考範圍，內容全部原創。
- Mac mini 用 `mini/<主題>` 分支；尚無遠端，只在本機 commit。

## Completed Work
- 2026-10-23：完成需求釐清與設計（sdd.md）；建立專案資料夾、git、分支 `mini/japanese-mvp`。
- 2026-10-23：完成 JLPT N4–N1 調查（jlpt-research.md）；目標定為一年內 N3～N2（2027/7 N3、2027/12 N2），每日約 2 小時；SDD 加入 JLPT 路線、聽解ドリル軌、ニュース・講義軌、JLPT 儀表板。

- 2026-10-23：高擬真原型 `prototype/index.html`（首頁、日劇第4話五步跟讀、Anki 5 種卡、即時応答ドリル、JLPT 儀表板、ライブラリ），發布為 Artifact https://claude.ai/artifact/M9NRbdF7unRabWfhc8mPKH ；原型用系統日語語音代替 Gemini。

- 2026-10-23：第一批內容完成並經校對：日劇《終電のあとで》e01–e06、動漫《放課後ラジオ部》e01–e06（共 305 句）、聽解ドリル w01/w02 各 d1–d6＋週日小模擬（共 120 題）；角色聲音 cast.json、兩部 bible、`curriculum/plan.json`（第 1–2 週細目＋第 3–8 週大綱）、`docs/content-spec.md`（寫課規格）。
- 工具：`tools/validate.py`（schema、ruby、連結、依上課順序檢查重複單字）＋ pytest 5 項、`tools/check_readings.py`（fugashi 斷詞比對讀音）、`tools/build_lexicon.py`（產生 `story/ja/lexicon.json`：單字 203、片語 56、文法 24）。
- 已知：check_readings 的不一致多為斷詞器誤判（小雨、日本、明日、七時、三階、何…），ruby 已人工確認。配音時 voice.py 應對數字、時刻、何、十分等易誤讀片段改送假名給 TTS。

- 2026-10-24：`tools/voice.py`：Gemini TTS（Interactions API，`google-genai` SDK，預設 `gemini-3.8-flash-tts`，可用 `GEMINI_TTS_MODEL` 改）逐句輸出 mp3＋`manifest.json`；依 cast 聲音＋語氣＋級別語速；斷詞比對後只把易誤讀片段（數字、七時、小雨…）改送假名；內容沒變就跳過；`--for-date` 依課表選當天檔案；`--dry-run`、`--limit`、`--rpm`。第一批共 1,142 段。測試 `tools/test_voice.py` 7 項（不呼叫 API）。尚未用真金鑰實測。

- 2026-10-24：手機 PWA 完成（根目錄 `index.html`、`app/`、`sw.js`、`manifest.webmanifest`、圖示）：
  - 首頁今日任務（日期解鎖、漏掉的依序補、連續天數、考試倒數）、一話五步（盲聽＋理解題、逐句理解、看字跟讀自動停頓、盲跟讀、收卡＋難度回饋，可中斷續播、Wake Lock、鎖屏控制）、Anki 式複習（FSRS-5 自寫、學習步驟、四子牌組交錯、兄弟卡、每日上限、按鈕顯示間隔、暫停卡、卡片一覽）、聴解ドリル（即時応答選項只用聽的、週日模擬換算 60 分）、ライブラリ、JLPT 頁（倒數、路線、各級學習量、題型正確率、模擬分數、記憶率）、設定（假名、跟讀次數與停頓、每日上限、記憶率、讀解教材、每週回饋 GitHub issue、備份匯出／匯入、清除）。
  - 沒有 mp3 時退回系統日語語音；Service worker 快取 App、劇本與音檔，可離線。
  - `tools/build_index.py` 產生 `scripts/index.json`；網址加 `?today=YYYY-MM-DD` 可模擬日期測試。
  - 測試：`node --test tests/*.test.js` 16 項（FSRS、卡片、佇列、ruby、今日任務、連續天數）。內建瀏覽器手機尺寸實測整個流程通過。
- 2026-10-24：`.github/workflows/voice.yml`（每天 03:00 配今天＋明天、scripts 有更新時也跑、可手動指定），需 repo Secret `GEMINI_API_KEY`；尚未上 GitHub。

- 2026-10-24：建立公開 repo https://github.com/LCCtaiwan/shadowing ，推送 `mini/japanese-mvp`（目前也是預設分支；尚無 main）；GitHub Pages 從此分支根目錄發布：https://lcctaiwan.github.io/shadowing/ ，線上實測首頁、索引、劇本皆 200、無 console 錯誤。

## Current Checkpoint
App 已上線 https://lcctaiwan.github.io/shadowing/ ；還沒有任何真的 Gemini 音檔（等使用者在「Gemini voice」終端機分頁貼金鑰，之後再用 `gh secret set` 設定 repo Secret）。

## Recommended Next Step
1) 使用者貼金鑰 → 試配、試聽調整 → 設 repo Secret `GEMINI_API_KEY`，讓 Actions 每天配音；2) iPhone Safari 開網址 → 分享 → 加入主畫面實測；3) 建 Claude 每週寫課例行工作；4) 之後是否建立 main 分支（需問使用者）。
