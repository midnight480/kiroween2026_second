# デプロイ手順 (Cloudflare Workers + Hyperdrive + Neon)

公開先は `https://tomoshibi.midnight480.com` です。手順は、いま必要なものから3段階に分けています。

| 段階 | 内容 | いつ |
|---|---|---|
| 1 | 静的配信。Vite のビルド結果を Workers で配る | 完了 |
| 2 | API と DB。Worker に `/api/*` を足し、Hyperdrive 経由で Neon につなぐ | `/api/health` まで完了。テーブルと API は未着手 |
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
| 依存パッケージ | `cf`、`@cloudflare/vite-plugin`、`pg`、`@types/pg` は導入済み (ユーザー確認済み)。これ以上足すときは、AGENTS.md の作業ルールに従い確認を取る |

---

## 段階1: 静的配信 (完了、2026-11-18)

- Worker `kiroween2026` (アカウント `d592a4c2a2de7ea02141c61c424b2a7c`) を作り、`tomoshibi.midnight480.com` をカスタムドメインにした。DNS レコードと証明書は Cloudflare が作る。手で DNS を足す必要はない。
- 段階2で Worker のコードを足したので、いまの配信方法は段階2の形 (Vite プラグインでビルドして `cf deploy`) になっている。`cf deploy ./dist` (静的アセットだけの形) はもう使わない。

### 公開後の確認

- [ ] `https://tomoshibi.midnight480.com/` で看板が開く
- [ ] `/members` (名簿) と `/help` (ヘルプ) が開く。ナビで3ページを行き来できる。`/members.html` は `/members` へ 307 で転送される (`htmlHandling: "auto-trailing-slash"`)
- [ ] ライトとダーク、英語と日本語が切り替わる
- [ ] スマートフォンで開ける
- [ ] `localStorage` はオリジンごとなので、`localhost` で作ったタスクは公開版には出ない (正常な動き)

---

## 段階2: API と DB (Neon + Hyperdrive)

`/api/health` まで完了 (2026-11-18)。本番で `{"ok":true,"db":"up","ms":~90}` を返す。

### 構成

```
ブラウザ ── tomoshibi.midnight480.com ── Worker kiroween2026
                                          ├─ /api/*   → worker/index.ts → env.HYPERDRIVE → Neon (ap-southeast-1)
                                          └─ それ以外 → 静的アセット (Vite のビルド結果)
```

| ファイル | 役割 |
|---|---|
| `cloudflare.config.ts` | Worker の設定。入口 `worker/index.ts`、`runWorkerFirst: ["/api/*"]`、Hyperdrive のバインディング `HYPERDRIVE`、`placement` (aws:ap-southeast-1)、カスタムドメイン |
| `vite.config.ts` | `@cloudflare/vite-plugin` (2.0) を入れる。HTML の3ページは画面側 (`environments.client`) の入口だけに指定する。全体の `build.rollupOptions.input` に書くと、Worker 側のビルドが HTML を入口と見なして失敗する |
| `worker/index.ts` | Worker のコード。いまは `GET /api/health` だけ。それ以外の `/api/*` は 404 の JSON |
| `worker/tsconfig.json` | Worker 側の型チェック。画面側の DOM の型と混ざらないよう分けている |
| `.cloudflare/types/index.d.ts` | `Env` の型。`cf workers types` が `cloudflare.config.ts` から生成する (git に入れない) |
| `.cloudflare/output/` | ビルド出力。`cf deploy` はここを上げる (git に入れない。`dist/` は使わなくなった) |

- Vite は 8 (プラグイン 2.0 が Vite 7 以降を要るため、6 から上げた)。
- ドライバは `pg` (node-postgres)。Hyperdrive では Neon のサーバーレスドライバではなく、通常のドライバを使う。`nodejs_compat` を有効にしている。
- リクエストごとに `new Client({ connectionString: env.HYPERDRIVE.connectionString })` を作り、応答後に `ctx.waitUntil(client.end())` で閉じる。プールは Hyperdrive が持つので、作り直しても遅くならない。
- DB のエラーの詳細はログ (`console.error`、observability) にだけ出し、応答には `{"ok":false,"db":"down"}` と 503 だけを返す。

### Neon

- プロジェクトは作成済み。接続情報は `.env.local` (neon CLI が書く)。リージョンは AWS ap-southeast-1 (Singapore)、DB は `neondb`。
- Hyperdrive には **Connection pooling をオフにした直接接続** (`DATABASE_URL_UNPOOLED`) を使う。プールは Hyperdrive が持つため。
- **未対応:** いまは所有者ロール `neondb_owner` でつないでいる。テーブルの読み書きだけできるアプリ用ロールを別に作り、Hyperdrive の接続先を差し替える (`cf hyperdrive update`)。
- **未対応:** 開発用ブランチ (`dev`) を作り、手元の開発は `dev`、本番の Hyperdrive は `main` につなぐ。いまは手元も本番も同じブランチ。

### テーブル (未着手)

- SQL を `db/migrations/0001_init.sql` のように番号付きでリポジトリに置く (中身は API の仕様が決まってから書く。`roadmap.md` の「API (予定)」)。
- 適用は、まず `dev` ブランチ、確かめてから `main`。Neon の SQL Editor に貼るか、`psql` で流す。
- 本番に流す前に、Neon のブランチ (または時点復元) で戻せる状態を作っておく。

### Hyperdrive の設定 (作成済み)

- 名前 `tomoshibi-db`、ID `30df9adadb30407ca0cfc43dd07dff9e`。ID は秘密の値ではないので `cloudflare.config.ts` に書いている。
- **キャッシュは無効。** Hyperdrive は、書き込んでも、キャッシュ済みの読み取り結果を消しません。タスク管理は書いた直後に読むので、キャッシュがあると古い一覧が返ります。
- 作り直すときも、**パスワードをコマンドの引数やシェルの履歴に残さない。** ダッシュボード (Storage & Databases > Hyperdrive) で作るのが安全です。2026-11-18 は `.env.local` を読む使い捨てのスクリプトから `cf hyperdrive create --body` を呼んで作った (作成中の数秒だけ、パスワードがこの Mac のプロセスの引数に載った)。

### 手元での開発

```bash
npm run dev     # Vite の開発サーバー。画面と /api/* の Worker を一緒に動かす (http://localhost:5173)
curl -s http://localhost:5173/api/health
```

- Vite プラグインが Worker を手元の workerd で動かす。手元では Hyperdrive を通らず、`.env.local` の `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE` で Neon に直接つながる。値は `${DATABASE_URL_UNPOOLED}` を参照させていて、接続文字列を二重に書いていない (`.env.example`)。
- **この変数がないと、`npm run dev` が起動しない** (Hyperdrive のバインディングに手元の接続先がない、というエラーになる)。
- 手元から本番と同じ DB に触れる。書き込みを試す前に `dev` ブランチを用意すること。

### 秘密の値

| 名前 | 本番の Worker | 手元の開発 |
|---|---|---|
| `CLERK_SECRET_KEY` | `sk_live_`。`.env.worker.production` (git 管理外、権限 600) に置き、`npm run deploy:secrets` で上げる。2026-11-18 に登録済み | `.env.development.local` の `sk_test_` (Vite プラグインが読む) |

- `cloudflare.config.ts` で `bindings.secret()` として宣言している。宣言したシークレットが Worker に入っていないと、デプロイは失敗する (`--dry-run` では検査されない)。
- 一度上げたシークレットは、その後の `npm run deploy` (ファイルなし) でも残る。2026-11-18 に確かめた。値を変えるときと、新しいシークレットを足すときだけ `npm run deploy:secrets` を使う。
- `cf deploy --secrets-file` は、ファイルの中で設定に宣言したキーだけを上げる。値はコマンドの引数にも画面にも出ない。
- `npx cf workers secrets update` は値を `--text` (引数) でしか受け取らないので使わない。ダッシュボード (Settings > Variables and Secrets) で入れてもよい。
- `.env.worker.production` の作り方 (値を画面に出さない):

```bash
umask 077
npx -y clerk@latest env pull --instance ins_3MHTMQGOd7lWTTgFeh5Mfbmk9yp --print | grep '^CLERK_SECRET_KEY=' > .env.worker.production
cut -d= -f2 .env.worker.production | cut -c1-8   # sk_live_ と出れば成功
```

- シークレットの名前の一覧: `npx cf workers secrets list --worker kiroween2026` (値は出ない)。
- Worker が読むのは Clerk の Secret Key だけ。Neon の接続情報は Hyperdrive の設定にあるので、Worker のシークレットには入れない。

### デプロイと確認

```bash
npm run deploy:check   # 型チェック (画面、Env の型の生成、Worker) → ビルド → 検査だけ。何も公開しない
npm run deploy         # 同じ流れで公開 (シークレットは前の版から引き継ぐ)
npm run deploy:secrets # .env.worker.production のシークレットも一緒に上げて公開
curl -s https://tomoshibi.midnight480.com/api/health
```

- `cf deploy` は `package.json` の `build` ではなく、`vite build` を直接動かす。そのため `deploy` のスクリプトで、先に `npm run typecheck` を流している。
- [ ] `/api/health` が `{"ok":true,"db":"up"}` を返す
- [ ] `/`、`/members`、`/help` は段階1と同じように開く (`/api/*` 以外は静的ファイル)
- [ ] (テーブルを作った後) 書いた直後に読んで、新しい値が返る (キャッシュが切れていること)

### ログと戻し方

```bash
npx cf observability tail --help          # 本番のログを流す (--worker kiroween2026)
npx cf workers deployments list --help    # 版の一覧
npx cf workers deployments create --help  # 前の版を指定してデプロイし直す
```

- 戻るのは Worker のコードと設定だけです。Neon のデータとテーブルは戻りません。
- テーブルを変える変更は、古いコードでも動く形 (列を足すだけ、など) で先に入れ、コードを替えた後で古い列を消す、の順にする。

---

## 段階3: 認証 (Clerk)

開発インスタンスでの組み込みは済んでいる (`roadmap.md` の「認証」)。キーは mode ごとの環境変数のファイルで分けている (`.env.example`)。`npm run deploy` は本番の mode でビルドするので、`.env.development.local` の開発用キーは入らない。本番用のキーは `.env.production.local` に置く。

段階2の後で入れます。DNS で気をつける点は `roadmap.md` の「検討中: 認証」にあります。

- Clerk の本番インスタンス用の CNAME は「DNS only」(プロキシなし) にする。
- `authorizedParties` に `https://tomoshibi.midnight480.com` を指定する。
- ログイン状態を `midnight480.com` の全サブドメインで共有しないよう、Clerk のドメインの範囲を決める。

---

## 決めること

| 項目 | 推奨 |
|---|---|
| 段階1をいま行うか | 行った (2026-11-18) |
| CLI | `cf` を devDependency に入れた (`npx` で毎回取りに行くより、版が固定される)。Wrangler は使わない |
| Neon のリージョン | 作成済みのプロジェクトは AWS Singapore (`ap-southeast-1`)。Worker の `placement` もそこに合わせた |
| デプロイを CI (GitHub Actions など) で行うか | 段階1は手元から。段階2で CI を足すなら、権限を絞った API トークンを使う |
