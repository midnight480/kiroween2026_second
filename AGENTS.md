# AGENTS.md

エージェント共通の指示書です。Claude Code、Kiro、その他のエージェントはこのファイルを正とします。
詳細は `docs/` を参照してください。

## プロジェクト概要

**灯 (Tomoshibi): The Candle Ledger**。期限を蝋燭として表現する、和ホラーのToDo Webアプリです。
Kiroween 2026 (https://kiroween.devpost.com/) の **Costume Contest** 部門向けに作ります。

> Costume Contest: Build any app but show us a haunting user interface that's polished and unforgettable. Bring in spooky design elements that enhance your app's function.

## 最重要方針

0. **タスク管理として成立させる。** 基本機能を担保したうえで、見た目にこだわります。演出でユーザーのデータを壊しません。振る舞いは `docs/task-management.md` の仕様に従います。
1. **怖さは機能を助ける。** 演出は「操作が分かりやすい・楽しい」に結びつけます。見た目だけの貼り付けは禁止です。
2. **見せない怖さ。** 派手な怪物やスプラッシュではなく、静けさ、間、日常のズレ、「何かいるかも」を重視します。
3. **日本のホラーが主、アメリカ要素は脇役。** ジャック・オー・ランタンはUI部品(追加ボタン、カウンタ)としてだけ使います。
4. **ジャンプスケアは期限切れの1回だけ。** それ以外の怖さは、じわじわ出す演出にします。
5. **読みやすさを守る。** 本文とボタンははっきり読めるようにします。かすれ文字や暗い配色は見出しと装飾に限ります。
6. **演出はオフにできる。** Safe mode、Mute、`prefers-reduced-motion` に必ず対応します。新しい演出にも適用してください。
7. **正体は説明しない。** 女の霊の由来や呪いの理由を、文章やUIで説明しません。一方、御札や盛り塩などの風習の意味は、海外の審査員に伝わるよう説明します (`docs/japanese-horror.md`)。

## 技術スタック

- Vite 8 + TypeScript (strict)。フレームワークなし。Cloudflare の Vite プラグイン (2.0) で、画面と Worker を一緒にビルドする。
- 描画は DOM + CSS + Canvas。
- 音はすべて Web Audio で生成します。音声ファイルは使いません。ノードの組み合わせ方は `docs/audio.md`。
- PWA としてホーム画面から使えるようにします。manifest と Service Worker は手書きで、依存パッケージは足しません (`docs/mobile.md`)。
- レスポンシブ対応。720px 未満では設定類をハンバーガーメニュー (襖) に収めます (`docs/mobile.md`)。
- 保存先: ゲストは `localStorage`。サインインした人の課題とプロジェクトは、Worker の API (`/api/data`、`/api/sync`) から Hyperdrive 経由で Neon に保存し、端末間で同じものが見える (`src/sync.ts`、`docs/deploy.md` の段階2)。名簿はプロジェクトの中 (`Project.members`) にあるので、プロジェクトと一緒に同期される。統計と設定は、サインインしても端末に残る。
- 公開 API: `/api/v1/*` を API キー (Clerk の API キー。アカウント画面で発行) で使う。使い方は `api.html`、設計は `docs/api.md`。
- サインインは Clerk (`@clerk/clerk-js`、Worker 側の検証は `@clerk/backend`)。任意で、ゲストのまま全機能が使えます。
- **設定の値は環境変数で渡します。** 変数の一覧は `.env.example` (コミットする、値は空)。実際の値は git 管理外のファイルに置き、コードや設定ファイルに直接書きません。
  - `.env.development.local`: `npm run dev` のときだけ読まれる。Clerk の開発用キー (`npx -y clerk@latest env pull --instance dev --file .env.development.local`)。
  - `.env.production.local`: `npm run build` / `deploy` のとき。Clerk の本番用キー。ない場合はサインインなしで公開される。
  - `.env.local`: 全ての mode。Neon の接続情報 (neon CLI が書く)。
  - 画面側に渡るのは `VITE_` で始まる変数だけです。`CLERK_SECRET_KEY` と `DATABASE_URL` は画面側のコードで使いません。Worker の `CLERK_SECRET_KEY` (本番は `sk_live_`) は `.env.worker.production` に置き、`npm run deploy:secrets` で入れます (`docs/deploy.md`)。`DATABASE_URL` は Worker に入れません (Hyperdrive 経由)。
  - 本番のビルドに開発用のキー (`pk_test_`) が入っても、`src/auth.ts` がサインインを止めます。
- デプロイ先は Cloudflare Workers (静的アセット)。公開ドメインは `tomoshibi.midnight480.com` で、DNS も Cloudflare で管理しています。
- 外部画像・外部素材は使いません。著作物 (貞子など特定作品の画像) は取り込みません。

## コマンド

```bash
npm install
npm run dev      # http://localhost:5173/?debug でデバッグAPI有効。/api/* の Worker も動く (.env.local に CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE が要る)
npm run build    # tsc --noEmit && vite build。変更後は必ず通すこと
npm run typecheck     # 画面の型チェック、Env の型の生成 (cf workers types)、Worker の型チェック
npm run deploy:check  # 型チェックとビルドをして、デプロイの検査だけ行う (何も公開しない)
npm run deploy        # 型チェックとビルドをして、Cloudflare Workers へデプロイ (シークレットは前の版から引き継ぐ)
npm run secrets:build  # .env.local の Neon の値を .env.worker.production に写す (値は出さない)
npm run deploy:secrets # 上に加えて .env.worker.production のシークレット (CLERK_SECRET_KEY、Neon の5つ) も上げる
npm run db:migrate    # db/migrations/*.sql を Neon に流す (.env.local の直接接続。済んだものは飛ばす)
npm run cf:whoami     # cf のログイン状態を確認 (未ログインなら npx cf auth login)
```

Cloudflare の操作は `cf` CLI (https://developers.cloudflare.com/cf/) で行います。Wrangler は使いません。設定は `cloudflare.config.ts` (Worker 名 `kiroween2026`、カスタムドメイン `tomoshibi.midnight480.com`、Hyperdrive)。ビルド出力は `.cloudflare/output/` (`dist/` は使わない)。手順は `docs/deploy.md`。

デバッグ (`?debug` 付きURL、コンソール):
- `__t.curse()` 期限切れの呪い演出を再生
- `__t.fire(0..5)` 気配演出を個別に発火 (0人影, 1目, 2囁き, 3カードのずれ, 4暗闇の揺らぎ, 5タイトル改変)

## ディレクトリ

```
index.html        ゲート、ヘッダー、看板(3列)、フッター、登録モーダル、#curse
members.html      名簿 (プロジェクトごとのメンバー、役割、最後に見た時)
help.html         ヘルプページ (ショートカット一覧、使い方)
api.html          API ドキュメント (キーの発行、エンドポイント、例)。ヘルプとは別のページ
privacy.html      プライバシーポリシー (英語と日本語。Cookie の選択のやり直し)
src/main.ts       看板の描画、カード、列の間のドラッグ、御札の封、燃やす、蝋の継ぎ足し、元に戻す、期限判定、テーマ、言語、ショートカット
src/dialog.ts     登録・編集モーダル (件名、期限、担当者、状態、プロジェクトの項目、参考資料、メモ、盛り塩のエラー)
src/projectDialog.ts プロジェクトの作成と設定 (項目の編集、削除)
src/links.ts      参考資料のリンクの検査、サービスの見分け、アイコン
src/members.ts    名簿の画面 (プロジェクトを選んで、その名簿を編集する)
src/api.ts        API ドキュメントのページ
src/auth.ts       任意のサインイン (Clerk)。看板を先に出し、読み込めなければゲストのまま
src/page.ts       名簿、ヘルプ、プライバシーで共通のテーマ・言語の初期化
src/consent.ts    Cookie のバナー。Cookie は Clerk のものだけなので、選べるのは Clerk をいつ読み込むか (ページを開いたとき / サインインを押したとき)
src/privacy.ts    プライバシーポリシーのページ
src/help.ts       ヘルプページ
src/curse.ts      期限切れの呪いシーケンス (暗転→血→女→飛びかかり)
src/presence.ts   気配の演出 (人影、目、囁き、ずれ、改変)
src/audio.ts      Web Audio による効果音・環境音
src/store.ts      Task型 (v2)、プロジェクトと名簿、localStorage (v1 からの移行、壊れたデータの退避)、統計、残り時間の整形、蝋燭の見た目の割合
src/i18n.ts       英語・日本語の辞書、期限の日時の整形 (和ホラーの語は入れない)
src/style.css     全スタイル (ライトとダークは変数で切り替え)
public/           favicon (favicon.svg が原本、favicon.ico、apple-touch-icon.png)。そのまま配信される
cloudflare.config.ts  Cloudflare Workers の設定 (cf CLI 用。Worker 名、カスタムドメイン、Hyperdrive、/api/* の振り分け)
worker/index.ts   Worker のコード (/api/health、/api/data、/api/sync)。Clerk のトークンで本人を確かめ、本人の行だけを読み書きする
worker/v1.ts      公開 API (/api/v1/*)。Clerk の API キーで持ち主を確かめる。回数の上限は api_rate テーブル
src/sync.ts       サインイン中の保存先。変わった課題とプロジェクトだけを /api/sync に送る。失敗したら残して送り直す
db/migrations/    Neon のテーブル (tasks、projects、api_rate)。npm run db:migrate で流す
worker/tsconfig.json Worker 側の型チェック (画面側の DOM の型と分ける)
docs/             設計資料 (下記)
```

## ドキュメント

- `docs/concept.md` 目的、審査基準、ユーザーの意向
- `docs/features.md` 基本機能、優先度、要判断の点
- `docs/projects.md` 複数プロジェクト、プロジェクトの項目、参考資料のリンク
- `docs/team.md` 名簿 (プロジェクトごと)、役割、最後に見た時
- `docs/api.md` 公開 API、API キー、上限
- `docs/task-management.md` タスク管理の機能仕様 (状態、データ、操作、受け入れ基準)
- `docs/visual-design.md` 色、文字、質感、動き、仕上げの確認項目
- `docs/japanese-horror.md` 和ホラー要素の意味と、審査員への英語の伝え方
- `docs/design-principles.md` ホラー設計の原則、演出ルール、安全面
- `docs/ui-mapping.md` 和ホラー要素とUI機能の対応、実装状況
- `docs/architecture.md` 構成、データ、シーケンス、拡張方法
- `docs/audio.md` 音の役割、Web Audio のノードの組み合わせ方、モバイルでの注意
- `docs/mobile.md` PWA、画面幅の区分、ハンバーガーメニュー、タッチ操作
- `docs/deploy.md` Cloudflare Workers、Hyperdrive、Neon へのデプロイ手順
- `docs/roadmap.md` 未実装項目と未確認事項

## 作業ルール

- 変更後は `npm run build` を通してください。
- 新しい演出を足すときは、「どの機能を助けるか」と Safe mode での振る舞いを `docs/ui-mapping.md` に書きます。和ホラーの要素なら、日本での意味と英語の1文を `docs/japanese-horror.md` に足します。
- Safe mode でどう振る舞うかを必ず決めます。閃光、人影、女の登場、大音量はSafe modeで無効にします。
- 依存パッケージの追加は、必要性をユーザーに確認してから行います。
- ユーザーとの会話と、ドキュメントは日本語。UIは英語と日本語に対応します (i18n)。和ホラーの語感を出す語 (例: 遅かったね、うしろ) は、どちらの言語でも日本語のまま出します。
- UIはライトとダークの両方に対応します。新しい演出は両方の表示で確認します (`docs/visual-design.md`)。
- 横幅が足りない端末を前提にします。新しい部品は、スマートフォン幅 (360px) での見え方とタッチでの操作を同じ変更で決めます (`docs/mobile.md`)。
- 新しい音は `docs/audio.md` の表に「伝える情報」と Safe mode の振る舞いを書いてから足します。
- 決定事項が変わったら、このファイルと `docs/` を同じ変更で更新します。
