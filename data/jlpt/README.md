# JLPT 單字庫

- 單字、讀音、英文釋義與級別：取自 [jamsinclair/open-anki-jlpt-decks](https://github.com/jamsinclair/open-anki-jlpt-decks)（MIT License，見 `LICENSE-open-anki-jlpt-decks.txt`），其資料源自 Jonathan Waller 的 [tanos.co.uk](http://www.tanos.co.uk/jlpt/)（CC BY）。JLPT 自 2010 年起不公布官方清單，級別為非官方推估。
- `raw-nN.json`：整理後的原始清單（每個字只保留第一個寫法與讀音、跨級重複只留最低級）。
- `nN.json`：Claude 補上的中文釋義、詞性、原創例句（附假名與中文）與單字連結，格式見 `docs/content-spec.md`「JLPT 單字庫」。
