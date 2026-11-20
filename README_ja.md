# 灯 Tomoshibi: The Candle Ledger

[English](README.md)

期限を蝋燭として表現する、和ホラーのToDoアプリです。怖い演出はすべて「何が急ぎか」を見分ける助けになり、Safe mode で全部オフにできます。

[Kiroween 2026](https://kiroween.devpost.com/) の **Costume Contest** 部門向けに作りました。

- 公開先: https://tomoshibi.midnight480.com (アカウントなしのゲストで使えます)
- デモ動画: `video/out/tomoshibi-demo.mp4` (`npm run video` で作ります。[docs/video.md](docs/video.md))

## 考え方

多くのToDoアプリは期限を日付で見せます。灯は蝋燭で見せます。作った時は満タンで、期限に向けて短くなるので、日付を読まなくても急ぎが分かります。

守る決まりは1つです。**怖いものは、すべてタスク管理を助けること。** 和ホラーは静かです。何かが飛び出すのではなく、画面の端で何かが動きます。

| 和ホラーの要素 | 日本での意味 | アプリでの役割 |
|---|---|---|
| 御札 | 悪いものを封じる紙の札 | タスク1件。封を長押しで剥がして完了にするので、誤って完了しません。 |
| 盛り塩 | 招かれないものを遠ざける塩 | 入力エラー。件名が空だと塩が崩れます。 |
| 気配 | 見えない何かがいる感じ | まれに出る静かな兆し (人影、カードのずれ)。看板が生きて見えます。 |
| 数え歌 | 子どもの数え歌 | 蝋燭の最後の10秒を数えます。 |
| 遅 | 朱の印 | 期限切れのタスクの印。英語版は「overdue」を添えます。 |

期限を逃すと、最も近い蝋燭が、時計より短く見えます。見た目だけで、実際の期限、文字の残り時間、保存した値は変わりません。

ジャンプスケアは **1回だけ** です。蝋燭が燃え尽きた時に、1タスクにつき1回出ます。**Safe mode** は閃光、人影、女を止め、同じ情報を文字と色で出します。**Mute** と `prefers-reduced-motion` にも対応します。

霊の由来は説明しません。

## 機能

- 3列の看板 (To do / In progress / Done)。ドラッグ、元に戻す、キーボード操作
- 複数プロジェクト、プロジェクトごとの項目、役割つきの名簿、GitHub や Google ドキュメントのリンク
- 英語と日本語、ライトとダーク、360px のスマートフォン幅、PWA
- 任意のサインイン (Clerk)。サインインすると Neon に保存され、端末間で同じものが見えます
- API キーで使う公開 API (`/api/v1/*`。`api.html` と [docs/api.md](docs/api.md))
- 音はすべて Web Audio で生成します。音声ファイルも外部画像も使いません

## 技術

- Vite 8 と TypeScript (strict)。フレームワークなし。DOM、CSS、Canvas
- Cloudflare Workers が画面と API を配信。Neon Postgres (Hyperdrive 経由)。サインインと API キーは Clerk
- ゲストの保存先は `localStorage`

## 手元で動かす

```bash
npm install
cp .env.example .env.local   # 値を入れる (下記)
npm run dev                  # http://localhost:5173/?debug
npm run build                # 型チェックとビルド
```

設定の値は環境変数で渡します。一覧は `.env.example` にあり、実際の値は git 管理外のファイル (`.env.local`、`.env.development.local`、`.env.production.local`) に置きます。Clerk のキーがなければゲストだけで動きます。`/api/*` には Neon の接続が要ります ([docs/deploy.md](docs/deploy.md))。

`?debug` を付けると、コンソールで `__t.curse()` (期限切れの呪い)、`__t.fire(0..5)` (気配の演出を1つ) が使えます。

デプロイなどのコマンドは [AGENTS.md](AGENTS.md) と [docs/deploy.md](docs/deploy.md) を見てください。

## Kiro の使い方

- **Steering** (`.kiro/steering/`): `product.md`、`tech.md`、`structure.md` は常に読み込みます。`horror-design.md` は演出のファイルを開いた時に読み込み、新しい演出の確認項目 (どの機能を助けるか、Safe mode、Mute、両テーマでの読みやすさ、ドキュメント) を示します。
- **Specs** (`.kiro/specs/`): `expiry-curse` と `kamikakushi-404`。
- **Hooks** (`.kiro/hooks/`): 保存時のビルド、英語と日本語の辞書の突き合わせ、演出ファイルの Safe mode 確認、手動のドキュメント同期。
- **Kiro CLI**: Cloudflare の `cf` CLI でのデプロイと、Neon の設定。

## ドキュメント

設計資料は [docs/](docs/README.md) にあります。入口は [AGENTS.md](AGENTS.md) です。

## ライセンス

MIT。[LICENSE](LICENSE) を見てください。
