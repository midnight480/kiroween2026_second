# 和ホラーの語彙と、海外の審査員への伝え方

審査員の多くは日本の風習を知りません。そのため、一つひとつの要素について「日本ではこういう意味がある」「だからこの操作になる」を短く伝えます。このファイルはその元ネタ帳です。Devpost の説明文、デモ動画の字幕、アプリ内の文言は、ここから作ります。

## 伝え方の原則

1. **風習と道具の意味は説明する。霊の正体は説明しない。** 御札や盛り塩が何のためのものかは書きます。女が誰で、なぜ来るのかは書きません (AGENTS.md 方針7)。
2. **1要素につき英語1文。** 長い解説は読まれません。「意味 → 操作」を1文でつなぎます。
3. **日本語の語は、ローマ字と意味を添える。** 例: *ofuda* (a paper talisman)。漢字は飾りとして見せ、意味は英語で伝えます。
4. **西洋ホラーとの違いを一度だけはっきり言う。** 審査員が「何が日本的なのか」をつかめるようにします。

## 西洋ホラーとの違い (説明文の導入に使う)

西洋のホラーは、怪物が現れて、それと戦うか逃げる話が多いです。日本のホラーでは、多くの場合「破ってはいけない決まり」があり、それを破ると何かが来ます。来るものは最後まではっきり見えず、理由も説明されません。

このアプリでは、その「決まり」をタスク管理のルールに重ねています。期限を守ること、封を雑に扱わないこと、振り返らないことです。

英語の下書き:

> Western horror gives you a monster to fight. Japanese horror gives you a rule you must not break, a presence you never quite see, and an ending no one explains. Tomoshibi turns those rules into the rules of a to-do list.

## 作品の枠組み (提案・未決定): 百物語

**百物語怪談会 (Hyakumonogatari Kaidankai)** は江戸時代に流行した遊びです。夜に百の灯をともし、怪談をひとつ語るごとに一つずつ消していきます。最後の灯が消えると本物の怪異が現れる、と言われていました。

このアプリの「タスク＝蝋燭」と同じ構造なので、作品全体の枠組みとして使う案です。

- タスクを完了することを、自分の手で灯を正しく消す作法とする。
- 期限切れは、灯が勝手に燃え尽きることとする。作法を破った扱いになり、何かが来る。

英語の下書き:

> In Edo-period Japan, people gathered at night, lit a hundred lights, and blew one out after each ghost story. When the last light died, something was said to come. In Tomoshibi, every task is one of those lights. Finish it and you put it out yourself. Let it burn down, and it goes out on its own.

採用するかはユーザーの確認待ちです (`roadmap.md` の未決定)。採用したら `concept.md` と AGENTS.md の概要に書きます。

## 要素ごとの意味と伝え方

「英語の下書き」は審査員向けの1文です。そのままアプリ内に出すものではありません。

### 見た目と空気

| 要素 | 日本での意味 | アプリでの表れ | 英語の下書き |
|---|---|---|---|
| 陰翳礼讃 (*In'ei Raisan*) | 谷崎潤一郎の随筆 (1933)。日本の美は、明るさより薄暗がりと陰の中にある、という考え | 画面全体を暗くし、灯とカーソルの周りだけを見せる。光が当たる所が、いま見るべき所 | *Lit the way Tanizaki described old Japanese rooms: mostly shadow, so that the light tells you where to look.* |
| 間 (*ma*) | 音や動きのない「間」に意味と緊張が宿る、という感覚 | 気配は20〜55秒に1回だけ。何も起きない時間を長く取る | *Most of the time, nothing happens. That silence is the point.* |
| 気配 (*kehai*) | 姿は見えないが、誰かがいると感じること | カードのわずかなずれ、暗がりの目、囁き、一瞬だけ変わるタイトル | *You never see it clearly. You only notice that something moved.* |
| 白昼の怪 | 明るい昼、障子の向こうや夏の田舎に出る怪異。八尺様など | ライト表示。障子に人影が映る | *Japanese ghosts do not need the dark. In light mode, it is a summer afternoon, and someone walks past behind the paper screen.* |
| 丑三つ時・逢魔が時 | 深夜2時頃と夕暮れ。魔に出会いやすい時刻とされる | 時刻で部屋の暗さと色が変わり、気配が増える | *At dusk and at 2 a.m., the hours when Japanese folklore says the boundary is thinnest, the room changes on its own.* |

### 決まりと罰

| 要素 | 日本での意味 | アプリでの表れ | 英語の下書き |
|---|---|---|---|
| 見るなのタブー (*miru-na*) | 「見てはいけない」を破って不幸になる話。イザナギが黄泉の国でイザナミを見てしまう神話や、『鶴の恩返し』 | 画面の端の人影に近づくと消え、蝋燭が縮む。フッターに「Do not look behind you」 | *An old Japanese taboo: do not look. If you move toward the figure at the edge of the screen, it is gone, and one of your candles is shorter.* |
| 呪いの連鎖 | 呪いが人から人へ移る。不幸の手紙や『リング』の呪いのビデオ | 期限切れのあと、近くの蝋燭が速く燃える | *Curses in Japan spread. One missed deadline makes the nearest candle burn faster.* |
| 来る (*kuru*) と遠い歌声 | 「何かが来る」予感は日本のホラーの中心。遠くから聞こえる女の歌声や、古いビデオテープの歪んだ音は、Jホラー (『リング』など) でよく使われる型。特定作品の歌は使わず、型だけを借りる | 残り60秒で、遠くから「くる」と歌う声がする | *A minute before a candle dies, a woman's voice sings one word from somewhere far away: kuru, "it is coming."* |
| 数え歌 (*kazoe-uta*) | 数を数えるわらべうた。日本のホラーでは不吉な場面でよく使われる | 残り10秒で「ひとつ、ふたつ…」と数える | *In the last ten seconds, a child's counting song counts down for you.* |

### お祓いと守り

| 要素 | 日本での意味 | アプリでの表れ | 英語の下書き |
|---|---|---|---|
| 御札 (*ofuda*) | 神社や寺の紙のお守り。災いを封じる。日本のホラーでは、剥がすと封じたものが出てくる | 各タスクは御札。完了するには封を長押しで剥がす | *Each task is written on an ofuda, a paper talisman. Peeling a seal is not done lightly, so you hold to peel it. It is also a confirmation that you meant it.* |
| 盛り塩 (*mori-shio*) | 戸口に置く小さな塩の山。清めと魔除け | 入力が足りないと塩が崩れる | *Salt keeps things out. When your input is wrong, the salt crumbles.* |
| お祓い (*oharai*) | 穢れを清める儀式 | 期限切れのカードは「exorcise」で片付ける | *A task that was cursed is not deleted. It is exorcised.* |
| 赤い紐・朱 | 結びつき、境界、魔除けの色 | 御札の上から垂れる赤い紐。朱色は印と罰にだけ使う | *Red marks a boundary, and here it marks only seals and punishments.* |

### 住むもの

| 要素 | 日本での意味 | アプリでの表れ | 英語の下書き |
|---|---|---|---|
| 座敷わらし (*zashiki-warashi*) | 東北の民話で家に住みつく子どもの精霊。いる家は栄え、去ると傾く | タスクが0件のときだけ現れる | *When there is nothing left to do, a zashiki-warashi, a child spirit of the house, appears. In folklore, it only stays in a house that is doing well.* |
| 怨霊 (*onryō*) | 恨みを残した霊。白い着物と長い黒髪の女の姿で語られることが多い (四谷怪談のお岩など) | 期限切れのときだけ、画面いっぱいに現れる | *She only comes when a candle dies. We will not tell you who she is.* |
| ジャック・オー・ランタン | (西洋の要素) | 追加ボタンと、呪われた数のカウンタ。UI部品としてだけ使う | *The only Western guest in the house is the jack-o'-lantern, and it works the door.* |

## 審査員に伝える場所 (予定)

| 場所 | 何を伝えるか | 状態 |
|---|---|---|
| Devpost の説明文 | 西洋ホラーとの違い、枠組み、要素の対応表 | ⬜ |
| デモ動画の字幕 | 要素が出た瞬間に、英語の下書きを1文ずつ | ⬜ |
| アプリ内 | 未決定 (候補: 日本語の語へのホバー注釈、ゲート画面の一文) | ⬜ |
