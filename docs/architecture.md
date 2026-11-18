# アーキテクチャ

## データ
`src/store.ts` の `Task` (v2):
```ts
interface Task {
  id: string;            // crypto.randomUUID()
  title: string;         // 1〜80文字
  note?: string;         // 0〜500文字
  assignee?: string;     // Member の id。アカウントができたらアカウントの id に置き換える
  created: number;       // ms。蝋燭の全長の起点
  due: number;           // ms。ユーザーが決めた期限。演出では変えない
  projectId: string;     // Project の id (projects.md)
  fields?: Record<string, string | number | boolean>;
  links?: { id: string; url: string }[];
  status: "todo" | "doing" | "done";
  doneAt?: number;
  late?: boolean;        // 期限後に完了した
  extended: number;      // 蝋を足した回数
  cursed: boolean;       // 呪い演出を再生済みか (1タスクにつき1回)
  penalty: number;       // ms。蝋燭が短く見える時間
  updated: number;
}
```
- 保存先は `localStorage` の `tomoshibi.tasks.v2`。初回に v1 (`tomoshibi.tasks.v1`) があれば、全て `todo` として移す。v1 のキーは消さない。
- 担当者の一覧は `tomoshibi.members` (`{ id, name, role, created, lastSeen? }[]`)、この端末の「自分」は `tomoshibi.me` (`team.md`)。設定は `tomoshibi.settings` (`safe`, `mute`, `lang`: en / ja, `theme`: system / light / dark)。ヘルプページも同じ設定を読む。
- 期限切れは `isOverdue()`: `status !== "done"` かつ `due <= now`。`cursed` は呪いを再生済みかだけを表す。
- 蝋燭の見た目の残り割合は `visualPct = (due - now - penalty) / (due - created)`。時計の残り割合は `truePct = (due - now) / (due - created)`。罰と伝染は `penalty` だけを増やす。
- 統計 `tomoshibi.stats`: `putOut` (完了とお祓いの数)、`late` (そのうち期限後の数)、`burned` (燃やした数)。
- 読めないデータは `tomoshibi.tasks.broken.<時刻>` に元の文字列を退避してから空で始める (`store.ts` `load()`)。保存に失敗したら `setSaveFailHandler` のコールバックで画面に知らせる。
- 完了、移動、削除は `main.ts` の `setStatus()` と `burnTask()`。直前の変更の前の状態を `snapshot()` で丸ごと持ち、5秒間だけ戻せる。

## 画面
- `index.html`: ゲート、ヘッダー (ブランドと「New candle」)、看板 (`#board` の3つの `.col`)、フッター、登録モーダル (`<dialog id="task-dialog">`)、`#curse`。
- `src/main.ts`: 看板の描画 (`render()` は並び順だけを直し、`refresh()` は毎秒、文字と蝋燭を直す)、カードの操作、列の間のドラッグ (`wireDrag()`)、期限判定、気配の hooks、ショートカット。
- `src/dialog.ts`: 登録・編集モーダル。入力の検証 (件名、期限の範囲) と、担当者の追加。結果は `onSubmit` で `main.ts` に渡す。
- `members.html` + `src/members.ts`: 名簿。仕様は `team.md`。
- `src/projectDialog.ts`: プロジェクトの作成と設定 (項目の編集、削除)。メニューは `main.ts` の `buildMenu()` / `openMenu()`。仕様は `projects.md`。
- `src/links.ts`: URL の検査 (`cleanUrl`、http(s) だけ)、サービスの見分け (`describe`)、アイコン (`icon`)。
- `help.html` + `src/help.ts`: ヘルプページ。ルーターは使わず、`vite.config.ts` で3ページをビルドする。
- `src/page.ts`: 名簿とヘルプで共通の、テーマと言語の初期化。3ページとも同じ `tomoshibi.settings` を読む。ページの間はヘッダーのナビ (看板 / 名簿 / ヘルプ) で移る。文言は HTML の `.en` / `.ja` で持ち、`<html lang>` で出し分ける。
- 登録モーダル、プロジェクトの設定、プロジェクトのメニューが開いている間、ドラッグ中、呪いの演出中は、期限判定と気配の演出を止める。
- 看板は `currentId` のプロジェクトのタスクだけを描く。期限判定は全プロジェクトのタスクに対して行う (ほかのプロジェクトの灯も消える)。

## 多言語とテーマ
- `src/i18n.ts`: 英語と日本語の辞書。`t(key, vars)`、`applyI18n()`、`formatDue()`。HTML は `data-i18n` (本文)、`data-i18n-html`、`data-i18n-ph` (placeholder)、`data-i18n-title`、`data-i18n-aria` で差し込む。動的な文言は `refresh()` で `t()` を呼ぶ。
- 和ホラーの語 (灯、遅、うしろ、遅かったね、数え歌) は辞書に入れない。どの言語でも日本語のまま出す。
- 初期言語は `navigator.language` が `ja` なら日本語、それ以外は英語。保存した設定が優先。
- テーマは `<html data-theme="light|dark">`。色は `style.css` の `:root` と `:root[data-theme="light"]` の変数で切り替える。`system` は `prefers-color-scheme` に従う。
- 時刻の色味は `applyAtmosphere()`。ダークは `--dark-mid` / `--dark-edge`、ライトは `--veil` を変える。
## 主な流れ

1. `index.html` のゲートで「Light the candle」を押す。`AudioContext` を作る (ブラウザの自動再生制限のため必須)。
2. `main.ts` が1秒ごとに `refresh()` (蝋燭、残り時間、数え歌の更新) と `checkExpiry()` (期限判定) を実行する。
3. `checkExpiry()` は、ドラッグ中、モーダル表示中、呪い演出中は実行しない。期限切れの未呪いタスクを1件ずつ処理する。
4. 処理は `cursed = true` にして保存し、`playCurse()` を待ち、期限が最も近い未完了の蝋燭を25%短く見せる (`penalty`)。

## 呪いシーケンス (`curse.ts`)

| 段階 | 内容 | 長さの目安 |
|---|---|---|
| 1 | 暗転と無音 | 1.8秒 |
| 2 | 血が上から流れて画面を覆う (22本の柱、遅延と速度がランダム) | 4.6秒 |
| 3 | 血が下へ流れ落ち、遠くに女が現れる。ドローンと心音 | 2.6秒 |
| 4 | 暗転を挟みながら女が近づく | 約8秒 |
| 5 | 静止の後、飛びかかる。短い閃光、揺れ、衝撃音 | 約1秒 |
| 6 | 黒。「遅かったね」とタイトル。フェードアウト | 約8秒 |

- 女は Canvas で毎フレーム描画する。シード固定の乱数で髪の束を生成し、揺れだけを時間で変える。
- Safe mode は 1 と 2 の後、女と閃光を飛ばして文字だけを出す。

## 気配 (`presence.ts`)

`startPresence(hooks)` がランダム間隔で `fire()` を呼ぶ。`PresenceHooks` で `main.ts` の状態(緊急度、カード、罰)に触れる。間隔は蝋燭の緊急度と時刻で変わる。

## 音 (`audio.ts`)

ノイズバッファ + BiquadFilter + Gain、OscillatorNode で合成する。`rustle`、`whisper`、`candleOut`、`thud`、`heartbeat`、`bloodSound`、`startDrone`、`lunge` を提供する。マスターゲインは 0.7、Mute は 0。音の役割、ノードの組み合わせ方、バスの構成案は `audio.md` にある。

## PWA (未実装)

`public/manifest.webmanifest`、`public/sw.js`、`public/icons/`、`public/_headers` を足し、`main.ts` で Service Worker を登録する。キャッシュ方針と画面幅ごとのレイアウトは `mobile.md` にある。

## 演出を追加する手順

1. `docs/ui-mapping.md` に、助ける機能と Safe mode での振る舞いを書く。和ホラーの要素なら `docs/japanese-horror.md` にも書く。
2. 気配なら `presence.ts` の `events` 配列に関数を足す。`hooks.safe()` で分岐する。
3. 音は `audio.ts` に合成関数を足す。音声ファイルは足さない。`audio.md` の表に行を足す。
4. タッチでの代わりと、狭い画面での見え方を決める (`mobile.md`)。文言は `src/i18n.ts` の両言語に足し、色は変数を使って、ライトとダークの両方で確認する。
5. `npm run build` を通し、`?debug` で目視確認する。スマートフォン幅でも確認する。
6. `AGENTS.md` と `docs/` を更新する。
