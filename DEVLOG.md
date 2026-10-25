# 開發日誌

## 2026-10-25 · 日語跟讀 App：三條劇集＋親子＋童話原文、廣播聽力、神經元單字卡、Gemini 雲端配音

**完成：** 專案 ~/Desktop/shadowing，公開 repo LCCtaiwan/shadowing，分支 mini/j；手機 PWA：首頁今日任務（新的一話三選一）、一話五步跟讀、FSRS-5 Anki 式複習（句子/單字/片語/文法＋連結
**決策：** Gemini 3.8 Flash TTS 在 Tier 1 每日僅 100 次請求；用多型號備援（3.8 flash/lite 走 interactions A
**Commits：** —

---

## 2026-10-25 · JLPT 單字庫：滑卡篩選、依考試日排每日量、手寫板、N5/N4 台灣用語中文，N3 撰寫中

**完成：** JLPT 單字滑卡篩選頁（app/views/words.js）：左滑我會了、右滑我要學，可復原；依考試日（studyP；App 內手寫板（app/lib/pad.js）：田字格、Apple Pencil 壓力、看答案時淡疊正確字形；手寫卡（
**決策：** 所有 JLPT 單字 zh 一律用台灣用語，不用大陸說法；N3 → N2 → N1 依序做
**Commits：** f403871 content: JLPT N4 單字庫 651 個；修正原始清單的送假名與讀音錯誤；develog 更新, 0740afd content: JLPT N5 單字庫 702 個（中文、例句、連結）；合併工具 merge_jlpt.py；考試計畫加「入門」選項, 173a2c5 feat: JLPT 單字滑卡篩選、依考試日排每日量、手寫板（手寫卡＋手寫練習）；JLPT 單字表原始資料（open-anki-jlpt-decks／tanos）, 0236c5c docs: 交班紀錄, c421ff8 audio: 自動配音 2026-10-24

---

