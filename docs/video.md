# デモ動画 (Devpost 提出用)

提出の条件: 3分以内、作ったものが動いている様子を見せる、YouTube に公開でアップロード、許可のない第三者の商標・音楽・著作物を入れない。

## 作り方

```bash
npm run video        # 下の3つを順に流す
node video/tts.mjs               # 1. ナレーション (英語) を macOS の say で音声にし、長さを測る
node video/record.mjs [場面...]  # 2. 本番のサイトをゲストのまま開き、場面ごとに録画する
node video/build.mjs             # 3. 映像と音声をつなぐ -> video/out/tomoshibi-demo.mp4
```

- 台本は `video/narration.json`。場面ごとに `text` (読む文)、`show` (映すもの)、`hold` (読む文より長く映す秒数) を持つ。声は `voice`、速さは `rate`。
- 1つの場面だけ録り直すときは `node video/record.mjs 07-curse` のように場面の id を渡し、`build.mjs` を流し直す。
- 出力は `video/out/` (git に入れない)。

## 録画のしかた

- 本番のサイト (`tomoshibi.midnight480.com/?debug`) を、サインインせずにゲストとして開く。デモの課題 (`scripts/demo-seed.mjs --print` の英語の方) を、ページを読み込む前にブラウザの `localStorage` に入れる。DB には何も書かない。
- 呪いの場面だけ、「Upload the demo video…」の期限を、ページを開いてから15秒後にずらす。数え歌から呪いが終わるまでを待ってから止める。
- `?debug` の `__t.fire()` で、人影とカードのずれを呼ぶ (気配の場面)。
- Safe mode はオフ、Mute はオン (ヘッドレスのブラウザは音を録らない)。
- Playwright はプロジェクトの依存に入れていない。npx のキャッシュにある `playwright-core` (または環境変数 `PLAYWRIGHT_CORE`) と、インストール済みの Google Chrome を使う。
- 画面は 1440×810 で録り、1920×1080 に拡大する。

## 音

- ナレーションは macOS の `say` (Samantha)。
- 下に、ffmpeg で作った低いノイズ (ブラウンノイズを低域だけ) を小さく敷く。音楽は使わない。
- アプリの効果音 (数え歌、呪いの音) は入らない。ヘッドレスのブラウザは映像しか録らないため。入れたい場合は、呪いの場面だけ OBS などで画面と音を録り、`video/out/clips/07-curse.webm` と差し替える。

## 場面

| id | 映すもの | 長さの目安 |
|---|---|---|
| 01-gate | ゲート | 8秒 |
| 02-board | 看板の全体 (3列、担当者、項目、リンク) | 18秒 |
| 03-haunting | 急ぎのカードの光、人影、削られた蝋燭 | 14秒 |
| 04-add | ジャック・オー・ランタンで追加、空の件名で盛り塩 | 19秒 |
| 05-finish | 長押しで封を剥がす、蝋を足す | 12秒 |
| 06-language | 「遅」の印 (overdue)、日本語・ライトへの切り替え | 11秒 |
| 07-curse | 数え歌、呪い | 44秒 |
| 08-outro | Safe mode をオン、まとめ | 20秒 |

## 提出前に確かめること

- 3分以内か (`build.mjs` が最後に合計を出す。いまは約2分27秒)。
- 第三者の商標: 画面に出るサービス名 (GitHub、Google Docs、Devpost) は、リンクのチップの文字とアプリが描いた簡単な形だけ。各社のロゴは使っていない。Clerk のサインイン画面は映さない。
- ナレーションの「Built with Kiro」が事実に合っているか。
