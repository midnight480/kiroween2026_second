# 設計: 神隠しの404ページ

## 配信

- `404.html` を足し、`vite.config.ts` の `build.rollupOptions.input` に加える。`dist/404.html` ができる。
- Cloudflare Workers の静的アセットは、`wrangler.jsonc` の `assets.not_found_handling` を `"404-page"` にすると、存在しないパスに `404.html` を 404 で返す。SPAフォールバック (`single-page-application`) は使わない。複数HTMLのアプリで、未知のパスを `index.html` にすると、404の意味が失われる。
- 開発サーバーでは、`vite` の既定は未知のパスに `index.html` を返す。確認は `npm run build && npm run preview` で行う。

## 部品

| 部品 | 場所 | 内容 |
|---|---|---|
| ページ | `404.html` | 既存の3ページと同じヘッダーとナビ。本文は `.en` / `.ja` で出し分ける |
| 初期化 | `src/page.ts` | テーマと言語の初期化を共有する |
| 場面 | `src/notfound.ts` | 影の描画と、消える演出。パスは `textContent` で出す |
| 文言 | `src/i18n.ts` / HTML | 英語と日本語。「神隠し」は日本語のまま |
| スタイル | `src/style.css` | 色は変数。影は CSS で描く |

## 場面

- 横に並んだ5つの影 (人の形のCSS)。1人だけが、列の中でわずかに揺れる。
- 約4秒かけて、その1人が薄れて消える。残りの影は動かない。消えた場所は、詰めずに空けておく。
- 空いた場所の下に、開こうとしたパスを小さく出す (例: `/foo/bar`)。
- 下に「看板へ戻る」のボタン (南瓜ではなく、御札の見た目)。

## Safe mode と動きを減らす設定

- `page.ts` が読む `tomoshibi.settings` の `safe`、または `prefers-reduced-motion` のとき、最初から消えた状態で静止して表示する。

## 確認方法

1. `npm run build && npm run preview` を起動し、`/does-not-exist` を開く。ステータスが 404 であること。
2. ライト / ダーク、英語 / 日本語、360px 幅。
3. パスに `<img src=x onerror=alert(1)>` を入れて、文字として出ること。
