# タスク: 神隠しの404ページ

- [ ] 1. ページを作る (要件 1, 2, 3, 7)
  - [ ] 1.1 `404.html` を作る。既存ページのヘッダーとナビを揃える
  - [ ] 1.2 `vite.config.ts` の `input` に `404.html` を足す
  - [ ] 1.3 `src/page.ts` でテーマと言語を初期化する
- [ ] 2. 場面を作る (要件 4, 5, 11)
  - [ ] 2.1 `src/notfound.ts` に影の列と、1人が消える演出を作る
  - [ ] 2.2 パスを `textContent` で出す。XSS を確認する
  - [ ] 2.3 Safe mode と `prefers-reduced-motion` で、消えた状態の静止表示にする
- [ ] 3. 文言と見た目を整える (要件 8, 9, 10)
  - [ ] 3.1 英語と日本語の文言。「神隠し」は日本語のまま
  - [ ] 3.2 ライトとダーク、360px 幅、タップ領域 44px
  - [ ] 3.3 `docs/japanese-horror.md` に、神隠しの意味と英語の1文を足す
- [ ] 4. 配信を設定する (要件 1)
  - [ ] 4.1 `wrangler.jsonc` の `assets.not_found_handling` を `404-page` にする (デプロイ設定の変更なので、ユーザーに確認してから)
  - [ ] 4.2 `npm run build && npm run preview` で、404 のステータスと本文を確認する
- [ ] 5. 文書を更新する
  - [ ] 5.1 `docs/ui-mapping.md` の 404 を ✅ にする
  - [ ] 5.2 `docs/roadmap.md` の候補から外す。`AGENTS.md` のディレクトリを更新する
