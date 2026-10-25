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

- 2026-10-24：使用者回饋「看不懂、點進去都沒東西」（因 10/26 才開課，全部被日期鎖住）→ 改為「下一話／下一份練習隨時可開始」（`isUnlocked`）；介面改中文為主（步驟、按鈕、評分「重來／困難／良好／簡單」），首頁加「第一次使用」說明卡（設定可重新顯示）。
- 2026-10-24：金鑰改存 GitHub Secret `GEMINI_API_KEY`（使用者自行在網頁設定，不經過對話）；Mac mini 上的金鑰輸入分頁已關閉。voice workflow 時限 300 分鐘；首次手動觸發配日劇 e01、動漫 e01。

- 2026-10-24：配音卡住原因查明：TTS 請求偶爾沒回應、原本沒設逾時（每段實際約 2 秒）→ 加 60 秒逾時、平行 4 個、單段失敗不中斷、workflow 失敗或逾時也 commit 已配好的、推送前 rebase、ffmpeg 轉 64k 單聲道。
- 2026-10-24：使用者新目標「日本旅行（帶長輩與兒童）＋動漫為主」、零碎時間練「單字與發音」：
  - 新增第三條線：家族旅行劇《三世代で日本へ》（`story/ja/family/`，一家六口：佳慧、阿哲、小米 7 歲、阿寶 4 歲、阿公膝蓋不好、阿嬤糖尿病＋蝦過敏；中村さん、そうた），第 1–6 集已寫並校對。三條線並行，首頁「新的一話（三選一）」。
  - 零碎時間：首頁「單字快練」（到期單字優先，聽 → 換你念 → 看意思，可錄音比對；還沒學過就預習下一話單字）與「發音聽辨」（`scripts/ja/pron/` 6 組 120 題：長音、促音、撥音、拗音、清濁；二選一）。
  - validate 新增：日文混入中文繁體字（黃/寶/數…）的檢查；重複新教單字改為同一部劇內檢查；標 review 的單字也產卡、也配音（三部劇順序不固定）。
  - Service worker 改為 App 本體網路優先，更新後馬上看到。

- 2026-10-24：配音真正原因：`gemini-3.8-flash-tts` 在 Tier 1 每日只有 100 次請求（429「100 requests per day on Tier 1」），SDK 會依 Retry-After 默默睡到額度重置。改為直接呼叫 REST（`tools/voice.py`）、重試最多等 60 秒、每日額度用完自動改用下一個 TTS 型號（3.8-flash-lite、3.1-flash-preview、2.5-pro/flash-preview；非 3.8 型號只能輸出 wav，用 ffmpeg 轉 mp3）、全部用完就停並保存；`--probe` 可查各型號狀態。
- 2026-10-24：神經元連結單字卡：`app/lib/network.js`（同漢字自動計算、劇中場景、搭配、相反、相關，學過的點亮）；單字卡背面顯示連結圖；新卡型「連結題」（`#link`，cue＿＿ 三選一，選項為辭書形）；單字快練也顯示連結圖。345 個單字都已加 `links`（330 個有搭配），規格見 content-spec「單字連結」。測試 20 項。

- 2026-10-24：內容擴充：自助旅行第 1–3、6 話改寫成 Skyliner、寄放行李、青年旅館、下北澤古著店（避開與家族旅行重複），e04 改成青年旅館；廣播聽力包 `scripts/ja/announce/` 6 組 48 題；親子一起學 `kids` 6 話；動漫第 3 週（推理、戀愛、熱血廣播劇，新角色悠斗）；日本童話原文 `tales` 6 篇 29 話（楠山正雄，青空文庫公有領域，validator 檢查與原文逐字相符，出處見 `story/ja/tales/README.md`）。內容皆已校對。
- 2026-10-24：配音：舊 TTS 型號改走 generateContent 端點（PCM→mp3）；同聲音片段（單字、發音、童話）合併請求再依靜音切開（`make_units`、`split_audio`，測試 14 項）；workflow 每日也配廣播、發音、童話。
- 待討論的主題清單在 `curriculum/queue.md`。

- 2026-10-25：JLPT 單字庫：`data/jlpt/raw-nN.json`（open-anki-jlpt-decks，MIT；資料源自 tanos.co.uk，CC BY；共約 8,100 字），N5（702）、N4（651）已補中文、詞性、原創例句、連結（`data/jlpt/n5.json`、`n4.json`；`tools/merge_jlpt.py` 合併並修正原始清單錯誤）。N3–N1 待補。
- 2026-10-25：App：「JLPT 單字篩選」（滑卡：我會了／我要學，可復原）、考試計畫（目前程度含「入門」、目標、考試日 → 還要背幾個、每天幾個，可自動調整每日新單字上限）、手寫板（`app/lib/pad.js`：田字格、Apple Pencil 壓力、看答案時疊上正確字形）＋手寫卡（每個單字一張，可在設定關閉）＋零碎時間「手寫練習」。
- 2026-10-25：主畫面圖示改為朱紅底「聴」（apple-touch-icon2.png）；配音修正：某天沒排課時不再中斷。

## Current Checkpoint
App 已上線：五條劇集線＋廣播聽力＋零碎時間（單字、發音、廣播、親子、手寫）＋神經元連結卡＋JLPT 單字篩選（N5、N4）＋手寫卡。配音受每日額度限制（約 100–200 次請求／天），合併請求後每天可配更多；未配音的片段 App 用系統語音代替。

## Recommended Next Step
1) 每天確認配音進度（`gh run list --workflow voice.yml`）；若要加速可考慮升級 Gemini 方案或把單字／發音改成一次請求唸多個再切段；使用者試聽調整聲音與語速；2) iPhone Safari 開網址 → 分享 → 加入主畫面實測；3) 建 Claude 每週寫課例行工作；4) 之後是否建立 main 分支（需問使用者）。
