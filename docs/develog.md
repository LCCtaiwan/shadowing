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
  - 本機預覽：`python3 -m http.server 8000`
  - 測試：`node --test tests/`、`python3 -m pytest tools/`

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

## Current Checkpoint
JLPT 路線已納入設計；下一步做高擬真原型。

## Recommended Next Step
高擬真原型（含 JLPT 儀表板與聽解ドリル）→ 第一批劇本。
