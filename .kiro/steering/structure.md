---
inclusion: always
---

# 構成

```
index.html / members.html / help.html   3ページ (看板、名簿、ヘルプ)
src/main.ts          看板、カード、ドラッグ、御札の封、期限判定、テーマ、ショートカット
src/dialog.ts        登録・編集モーダル
src/projectDialog.ts プロジェクトの作成と設定
src/links.ts         参考資料のリンクの検査と見分け
src/members.ts       名簿
src/curse.ts         期限切れの呪い (暗転→血→女→飛びかかり)
src/presence.ts      気配の演出
src/audio.ts         Web Audio
src/store.ts         Task型 v2、localStorage、統計
src/i18n.ts          英語・日本語の辞書
src/page.ts          名簿とヘルプの共通初期化
src/style.css        全スタイル (ライト/ダークは変数)
docs/                設計資料
.kiro/               steering、specs、hooks
```

新しい演出を足す手順は `docs/architecture.md` の「演出を追加する手順」に従う。
