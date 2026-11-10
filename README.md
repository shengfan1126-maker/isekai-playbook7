# isekai-playbook7

異世界 RPG 單人刷原型：**劇本 2（廢柴技能、單人刷、365 天、魔王 BP99 復活）**。
設計筆記在 Claude Project「RPG设计」（`異世界RPG_單刷框架清單.md`、`異世界RPG_劇本2_定案_1110.md`）。

## 狀態
- 基底：複製自 monster-game v0.45 引擎（判定、世界之聲、異香、整合、OOC），**尚未改動**。
- 下一步：拿掉大賢者／吞噬／同伴；加技能每天 3 次、開場 3 個廢柴技能、365 天倒數與魔王。

## 規則（沿用 monster-game）
- 所有 .js 共用全域，不用 import/export/IIFE/"use strict"，頂層名稱不可重複。
- 不改存檔格式，新欄位在 save.js 的 `heal()` 補預設。
- 介面繁體中文；給整份檔案；不放金鑰；改完跑 `node --check`。
