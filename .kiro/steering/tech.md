---
inclusion: always
---

# 技術方針

- Vite 6 + TypeScript (strict)。フレームワークなし。ルーターなし (複数HTMLをビルド)。
- 描画は DOM + CSS + Canvas。外部画像・外部素材は使わない。特定作品 (貞子など) の画像は取り込まない。
- 音はすべて Web Audio で合成する。音声ファイルは使わない。
- 保存は `localStorage`。バックエンドは現時点でなし (認証は検討中)。
- PWA は手書きの manifest と Service Worker。依存は足さない。
- デプロイは Cloudflare Workers (静的アセット)。公開ドメインは `tomoshibi.midnight480.com`。
- **依存パッケージの追加は、必要性をユーザーに確認してから行う。**

## コマンド

```bash
npm install
npm run dev     # ?debug を付けると __t.curse() / __t.fire(0..5) が使える
npm run build   # tsc --noEmit && vite build。変更後は必ず通す
```

## 変更のたびに確認すること

- ライトとダークの両方。英語と日本語の両方。
- スマートフォン幅 (360px) とタッチ操作。
- Safe mode と Mute を入れても、全機能が使える。
- 文言は `src/i18n.ts` の両言語に足す。色はCSS変数を使う。

#[[file:docs/architecture.md]]
