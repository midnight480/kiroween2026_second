import { defineConfig } from "cf/config";

// 灯 Tomoshibi の Worker 設定 (cf CLI 用)。Worker のコードはまだなく、`cf deploy ./dist` で
// Vite のビルド結果だけを配る。手順は docs/deploy.md。

export default defineConfig({
	worker: {
		name: "tomoshibi",
		compatibilityDate: "2026-11-01",
		observability: {
			enabled: true,
		},
		domains: [
			"tomoshibi.midnight480.com",
		],
	},
});
