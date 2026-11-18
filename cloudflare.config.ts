import { bindings, defineConfig } from "cf/config";

// 灯 Tomoshibi の Worker 設定 (cf CLI 用)。画面は Vite のビルド結果を静的アセットとして配り、
// /api/* だけ Worker のコード (worker/index.ts) を通す。手順は docs/deploy.md。

export default defineConfig({
	accountId: "d592a4c2a2de7ea02141c61c424b2a7c",
	worker: {
		name: "kiroween2026",
		compatibilityDate: "2026-11-01",
		// pg (node-postgres) が Node.js の API を使う
		compatibilityFlags: ["nodejs_compat"],
		entrypoint: "./worker/index.ts",
		assets: {
			// /members.html は /members へ転送し、/members で members.html を返す (既定値)
			htmlHandling: "auto-trailing-slash",
			// /api/* だけ Worker を先に通す。それ以外は静的ファイルをそのまま返す
			runWorkerFirst: ["/api/*"],
		},
		env: {
			// Neon への接続。Hyperdrive の設定 tomoshibi-db (キャッシュ無効)。
			// 手元の開発では .env.local の CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE で直接つなぐ
			HYPERDRIVE: bindings.hyperdrive({ id: "30df9adadb30407ca0cfc43dd07dff9e" }),
			// Clerk の本番の Secret Key (sk_live_)。値は git 管理外の .env.worker.production に置き、
			// npm run deploy:secrets で上げる。宣言しておくと、入っていないままのデプロイは失敗する。
			// 手元の開発では .env.development.local の sk_test_ が使われる
			CLERK_SECRET_KEY: bindings.secret(),
		},
		// Neon (aws ap-southeast-1) の近くで Worker を動かす
		placement: { region: "aws:ap-southeast-1" },
		observability: {
			enabled: true,
		},
		domains: [
			"tomoshibi.midnight480.com",
		],
	},
});
