# 撮影用のデモデータ

デモ動画とスクリーンショットのために、本番の帳面へ「Kiroween 2026 の提出作業を進めるチーム」の課題を入れます。スクリプトは `scripts/demo-seed.mjs` です。

## 使い方

```bash
npm run demo:seed                     # 英語の件名。呪いは3分後
npm run demo:seed -- --lang ja        # 日本語の件名
npm run demo:seed -- --curse-in 5     # 呪いを5分後にする (1〜30)
npm run demo:seed -- --remove         # デモを消す
npm run demo:seed -- --print          # DB に書かず、JSON を出すだけ (手元の確認用)
```

時刻はすべて、スクリプトを流した瞬間から数えます。**撮る直前に流してください。** 流したら看板を再読み込みし、プロジェクトのメニュー (P) で「Kiroween 2026 entry」を選びます。

## 何に書くか

- 誰の帳面か: `.env.production.local` の `TOMOSHIBI_API_KEY` の持ち主。公開 API (`GET /api/v1/projects`) で、その人のプロジェクトを調べて決める。
- 書き込み: `.env.local` の `DATABASE_URL_UNPOOLED` (直接接続) で、看板が保存するのと同じ JSON を入れる。公開 API では、作った時刻 (燃え残りの長さ)、名簿、参考資料のリンク、プロジェクトの項目、呪いの済み印を入れられないため。
- 触るのは、プロジェクト `demo-kiroween2026` と、id が `demo-` で始まる課題だけ。流すたびに入れ直す。ほかの課題とプロジェクトには触らない。
- デモのプロジェクトは作成日時をいまにする。公開 API で `project` を省いたときの行き先 (いちばん古いプロジェクト) を変えないため。
- 看板を開いたまま流すと、看板が手元の古い値を送り返すことがある。流したら再読み込みする。

## 再現する見え方

| 課題 | 状態 | 見せるもの |
|---|---|---|
| Upload the demo video before the deadline | 進行中、残り `--curse-in` 分 | 短い蝋燭 (low、urgent)、最後の10秒の数え歌、期限切れの呪い (ジャンプスケア。Safe mode では出ない) |
| Tune the whisper | 進行中、残り1日 | 気配で削られた蝋燭 (`penalty`)。時計の残りは半分、蝋は1割 |
| Polish the ofuda cards | 進行中、残り6時間 | 蝋の継ぎ足し2回、GitHub Issue と Slides のリンク |
| Check the board at 360px | 未着手、残り18分 | urgent (残りが1割強) |
| Read the submission rules again | 期限切れ、呪い済み | 「遅」の印、too late、Haunted の数 |
| Draw the woman of the curse | 完了 (遅れ) | late の完了 |
| ほかの完了、未着手 | | 担当者 (5人、役割と最後に見た時)、項目 (領域、動画に入れる)、リンクのチップ |

- リンクの GitHub の Issue と PR の番号、Google のドキュメントの id は見た目のための架空のもの。開いても中身はない。
- 撮影の前に、Safe mode をオフにする (オンだと女の登場と閃光が出ない)。音を入れるなら Mute もオフにする。
