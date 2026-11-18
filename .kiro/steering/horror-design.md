---
inclusion: fileMatch
fileMatchPattern: "src/{curse,presence,audio}.ts,src/style.css"
---

# 演出を触るときのルール

演出のファイルを編集している。次を満たすこと。

1. **助ける機能を決める。** `docs/ui-mapping.md` に「和ホラー要素 / UIでの使い方 / 機能面の役割」を1行足す。決められない演出は入れない。
2. **Safe mode の振る舞いを決める。** 閃光、人影、女の登場、大音量は Safe mode で無効。血と文字は残してよい。
3. **Mute で情報が失われない。** 音で伝える情報は、文字か見た目でも伝える。
4. **強い演出は期限切れの1回だけ。** ほかは「間」と「違和感」で出す。頻度は `docs/design-principles.md` に従う。
5. **操作を邪魔しない。** 入力中、ドラッグ中、モーダル表示中、封を剥がしている最中は、操作対象を動かさない。
6. **実データを変えない。** 罰や伝染は `Task.penalty` (見た目) だけを変える。`due` は変えない。
7. **和ホラーの要素を足したら**、日本での意味と英語の1文を `docs/japanese-horror.md` に足す。
8. **音を足したら**、`docs/audio.md` の表に「伝える情報」と Safe mode の振る舞いを書く。

#[[file:docs/design-principles.md]]
#[[file:docs/japanese-horror.md]]
#[[file:docs/audio.md]]
