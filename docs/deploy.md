# デプロイ手順 (Cloudflare Workers + Hyperdrive + Neon)

公開先は `https://tomoshibi.midnight480.com` です。手順は、いま必要なものから3段階に分けています。

| 段階 | 内容 | いつ |
|---|---|---|
| 1 | 静的配信。`npm run build` の `dist/` を Workers で配る | いますぐできる (アプリは `localStorage` だけで動く) |
| 2 | API と DB。Worker に `/api/*` を足し、Hyperdrive 経由で Neon につなぐ | API キー、サインイン、端末間の同期を作るとき |
| 3 | 認証 (Clerk) | 段階2と一緒か、その後 (`roadmap.md` の「検討中: 認証」) |

Cloudflare の操作には `cf` CLI を使います (https://developers.cloudflare.com/cf/)。Wrangler は使いません。`cf` は 2026-11-18 時点で 1.0 のリリース候補 (`1.0.0-rc.1`) です。設定の形式とデプロイのコマンドは安定版扱いですが、あまり使われない API コマンドは 1.0 までに変わることがあります。

確認した資料 (2026-11-18 時点):
- cf CLI: https://developers.cloudflare.com/cf/ (Wrangler との関係は https://developers.cloudflare.com/cf/wrangler/)
- Workers の静的アセット: https://developers.cloudflare.com/workers/static-assets/binding/
- HTML の扱い (末尾スラッシュ): https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/
- カスタムドメイン: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- Hyperdrive の始め方: https://developers.cloudflare.com/hyperdrive/get-started/
- Hyperdrive のキャッシュ: https://developers.cloudflare.com/hyperdrive/concepts/query-caching/
- Neon と Hyperdrive: https://neon.com/docs/guides/cloudflare-hyperdrive

コマンドは変わることがあります。`--help` を順にたどるより、`npx cf cli search "<やりたいこと>"` で探し、見つけたコマンドの `--help` を見てください。

---

## 段階0: 前提

| 項目 | 確認すること |
|---|---|
| Cloudflare アカウント | `midnight480.com` のゾーンがこのアカウントにあり、有効 (Active) であること |
| DNS | `tomoshibi.midnight480.com` に、既存の CNAME レコードがないこと。CNAME があるホスト名にはカスタムドメインを作れない (`npx cf dns records list --zone midnight480.com` で確かめる) |
| cf の認証 | 手元では `npx cf auth login` (ブラウザで許可)。`cf` は Wrangler のログインを使い回さない。CI では `CLOUDFLARE_API_TOKEN` と `CLOUDFLARE_ACCOUNT_ID` を設定し、トークンの権限は、デプロイ、カスタムドメイン、Hyperdrive に要るものだけに絞る。トークンの値はチャットやリポジトリに貼らない |
| Neon アカウント | 段階2から必要 |
| 依存パッケージ | `cf` は導入済み。段階2で `pg` と `@types/pg` を足す。AGENTS.md の作業ルールに従い、足す前にユーザーの確認を取る |

---

## 段階1: 静的配信

### 1-1. cf (導入済み)

```bash
npm install -D cf    # 導入済み。package.json に入っている
npx cf --version
npx cf auth login    # 初回だけ
npx cf auth whoami   # どのアカウントで動くかを確かめる (npm run cf:whoami でも同じ)
```

### 1-2. `cloudflare.config.ts` (作成済み)

リポジトリ直下に置いています。Worker のコードはまだないので、Worker 名とカスタムドメインだけを書きます。

```ts
import { defineConfig } from "cf/config";

export default defineConfig({
  worker: {
    name: "tomoshibi",
    compatibilityDate: "2026-11-01",
    observability: { enabled: true },
    domains: ["tomoshibi.midnight480.com"],
  },
});
```

- 配る中身は、`cf deploy ./dist` のようにディレクトリを渡して決める。この形は「サーバー側のコードがないプロジェクト」用で、静的アセットだけの Worker になる。
- カスタムドメインにすると、DNS レコードと証明書は Cloudflare が作ります。手で DNS を足す必要はありません。
- HTML の扱いは既定の `auto-trailing-slash` です。`/members.html` は `/members` へ 307 で転送され、`/members` で `members.html` が返ります。看板の中のリンクは `members.html` と `help.html` を指していますが、転送されてから表示されるので、このままで動きます。
- `wrangler.jsonc` や `wrangler.toml` をリポジトリに置かないでください。それらがあるプロジェクトで `cf dev`、`cf build`、`cf deploy` を実行してはいけないと、`cf` のドキュメントに書かれています。

### 1-3. スクリプトと除外ファイル (設定済み)

`package.json` の `scripts`:

```json
"deploy:check": "npm run build && cf deploy ./dist --dry-run",
"deploy": "npm run build && cf deploy ./dist",
"cf:whoami": "cf auth whoami"
```

`.gitignore`:

```
.cloudflare
.dev.vars*
.env*
```

`.cloudflare/` には、`cf` が作るビルド出力 (`.cloudflare/output`) と手元の状態が入ります。

### 1-4. 確かめてからデプロイ

```bash
npm run deploy:check   # ビルドと、アップロードする中身の確認だけ。何も公開しない (認証も不要)
npm run deploy         # 公開
```

### 1-5. 公開後の確認

- [ ] `https://tomoshibi.midnight480.com/` で看板が開く
- [ ] `/members` (名簿) と `/help` (ヘルプ) が開く。ナビで3ページを行き来できる
- [ ] ライトとダーク、英語と日本語が切り替わる
- [ ] スマートフォンで開ける
- [ ] `localStorage` はオリジンごとなので、`localhost` で作ったタスクは公開版には出ない (正常な動き)

### 1-6. 戻し方とログ

```bash
npx cf workers deployments list --help      # 引数を確かめてから使う
npx cf workers deployments create --help    # 前の版を指定してデプロイし直す
npx cf observability tail --help            # 本番のログを流す (--worker で Worker を指定)
```

---

## 段階2: API と DB (Neon + Hyperdrive)

> **注意: 段階2は Wrangler 前提で書いた下書きです。** 着手するときに `cf` 用に書き直します。
> - 設定は `wrangler.jsonc` ではなく `cloudflare.config.ts` に書く。Hyperdrive のバインディング、`run_worker_first`、`placement` の書き方は `cf` のドキュメントで確かめる。
> - Worker のコードを足すと `cf deploy ./dist` は使えない。`cf init .` などで Cloudflare の Vite プラグイン (`@cloudflare/vite-plugin`、要確認) を入れ、`cf deploy` でビルドとデプロイを行う形になる見込み。
> - コマンドの読み替え: `wrangler hyperdrive create` → `cf hyperdrive create`、`wrangler secret put` → `cf workers secrets update`、`wrangler types` → `cf workers types`、`wrangler dev` → `cf dev`、`wrangler tail` → `cf observability tail`、`wrangler rollback` → `cf workers deployments` 系。

### 2-1. Neon を用意する

1. Neon でプロジェクトを作る。リージョンは利用者の多い場所に近いものを選ぶ (日本向けなら AWS の Tokyo、`aws-ap-northeast-1`)。
2. データベース `tomoshibi` を作る。
3. アプリ用のロールを、所有者 (`neondb_owner`) とは別に作る。権限は `tomoshibi` のテーブルの読み書きだけにする。Hyperdrive にはこのロールを使う。
4. 開発用のブランチ (`dev`) を作る。手元の開発は `dev` に、本番の Hyperdrive は `main` につなぐ。
5. 接続文字列は、**Connection pooling をオフ**にした直接接続のものを使う。プールは Hyperdrive が持つため。形は `postgresql://<role>:<password>@ep-xxxx.ap-northeast-1.aws.neon.tech/tomoshibi?sslmode=require`。

### 2-2. テーブルを作る

- SQL を `db/migrations/0001_init.sql` のように番号付きでリポジトリに置く (中身は API の仕様が決まってから書く。`roadmap.md` の「API (予定)」)。
- 適用は、まず `dev` ブランチ、確かめてから `main`。Neon の SQL Editor に貼るか、`psql` で流す。
- 本番に流す前に、Neon のブランチ (または時点復元) で戻せる状態を作っておく。

### 2-3. Hyperdrive の設定を作る

- **パスワードをコマンドの引数に書かない。** シェルの履歴に残るためです。Cloudflare のダッシュボード (Storage & Databases > Hyperdrive > Create) で作ることを勧めます。
- CLI で作る場合は、接続文字列を履歴に残らない方法で環境変数に入れてから渡してください。

```bash
# 例: 入力を画面に出さずに読み込む (zsh)
read -s "NEON_URL?Neon direct connection string: "; export NEON_URL
npx wrangler hyperdrive create tomoshibi-db --connection-string="$NEON_URL" --caching-disabled
unset NEON_URL
```

- **キャッシュは切る (`--caching-disabled`)。** Hyperdrive は、書き込んでも、キャッシュ済みの読み取り結果を消しません。タスク管理は書いた直後に読むので、キャッシュがあると古い一覧が返ります。
- 出てきた `id` を控えます。`id` は秘密の値ではないので、`wrangler.jsonc` に書いてかまいません。

### 2-4. Worker のコードと設定

Worker のコードは、ブラウザ側 (`src/`) と分けて `worker/` に置きます。型の設定 (DOM と Workers) が混ざらないよう、`worker/tsconfig.json` を別に持ちます。

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "tomoshibi",
  "compatibility_date": "2026-11-18",
  "main": "worker/index.ts",
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "html_handling": "auto-trailing-slash",
    // /api/* だけ Worker のコードを先に通す。それ以外は静的ファイルをそのまま返す
    "run_worker_first": ["/api/*"]
  },
  "hyperdrive": [
    { "binding": "HYPERDRIVE", "id": "<2-3 で控えた id>" }
  ],
  // DB の近くで Worker を動かす。1回のリクエストで何度も問い合わせる場合に効く
  "placement": { "region": "aws:ap-northeast-1" },
  "routes": [
    { "pattern": "tomoshibi.midnight480.com", "custom_domain": true }
  ]
}
```

- ドライバは `pg` (node-postgres、8.16.3 以降) を使う。Hyperdrive では Neon のサーバーレスドライバではなく、通常のドライバを使う。
- リクエストごとに `new Client({ connectionString: env.HYPERDRIVE.connectionString })` を作る。プールは Hyperdrive が持つので、作り直しても遅くならない。
- 型は手で書かず、`npx wrangler types` で生成する。
- まず `GET /api/health` (DB に `SELECT 1` を投げるだけ) を作り、つながることを確かめる。

```bash
npm install pg            # 要確認
npm install -D @types/pg  # 要確認
npx wrangler types
```

### 2-5. 手元での開発

- 接続先は Neon の `dev` ブランチ。接続文字列は `wrangler.jsonc` に書かず、環境変数で渡す (パスワードを含むため)。

```bash
# .env (git に入れない)
CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE=postgresql://<role>:<password>@<dev のホスト>/tomoshibi?sslmode=require
```

```bash
npm run build
npx wrangler dev          # 手元で Worker と静的ファイルを配る
```

- 手元では Hyperdrive を通らず、DB に直接つながる。接続の使い回しの効果は本番でしか分からない。
- 本番の Hyperdrive 越しに試す場合は `npx wrangler dev --remote` (Worker 全体が Cloudflare 上で動き、本番の DB に触れるので、書き込むテストはしない)。
- `npm run dev` (Vite) は画面だけの開発に使い続ける。API を試すときだけ `wrangler dev` を使う。

### 2-6. 秘密の値

- Clerk の Secret Key などは `npx wrangler secret put CLERK_SECRET_KEY` で入れる (値は対話で入力し、引数に書かない)。
- `wrangler secret put` は、それだけで新しい版をデプロイする。段階的に入れたい場合は `wrangler versions secret put` を使う。
- 手元用の値は `.dev.vars` か `.env` に置き、git に入れない。

### 2-7. デプロイと確認

```bash
npm run deploy:check
npm run deploy
curl -s https://tomoshibi.midnight480.com/api/health
npx wrangler tail          # 本番のログを見る
```

- [ ] `/api/health` が DB の応答を返す
- [ ] `/`、`/members`、`/help` は段階1と同じように開く (`/api/*` 以外は静的ファイル)
- [ ] 書いた直後に読んで、新しい値が返る (キャッシュが切れていること)

### 2-8. 戻すときの注意

- `wrangler rollback` で戻るのは Worker のコードと設定だけです。Neon のデータとテーブルは戻りません。
- テーブルを変える変更は、古いコードでも動く形 (列を足すだけ、など) で先に入れ、コードを替えた後で古い列を消す、の順にする。

---

## 段階3: 認証 (Clerk)

段階2の後で入れます。DNS で気をつける点は `roadmap.md` の「検討中: 認証」にあります。

- Clerk の本番インスタンス用の CNAME は「DNS only」(プロキシなし) にする。
- `authorizedParties` に `https://tomoshibi.midnight480.com` を指定する。
- ログイン状態を `midnight480.com` の全サブドメインで共有しないよう、Clerk のドメインの範囲を決める。

---

## 決めること

| 項目 | 推奨 |
|---|---|
| 段階1をいま行うか | 行う。審査用の URL を早めに用意できる |
| CLI | `cf` を devDependency に入れた (`npx` で毎回取りに行くより、版が固定される)。Wrangler は使わない |
| Neon のリージョン | AWS Tokyo (`aws-ap-northeast-1`)。審査員は海外だが、API は段階2からなので、利用者の中心で選ぶ |
| デプロイを CI (GitHub Actions など) で行うか | 段階1は手元から。段階2で CI を足すなら、権限を絞った API トークンを使う |
