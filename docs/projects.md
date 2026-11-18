# プロジェクト、項目、参考資料のリンク

複数のプロジェクトを持ち、プロジェクトごとに項目を足し、タスクに参考資料のリンクを貼る仕様です。

## 決定事項

- 看板は1プロジェクトずつ表示する。ヘッダーのメニューで切り替える。
- 名簿 (`team.md`) は全プロジェクトで共通。
- GitHub はリンクを貼るだけ。API での取り込みや同期はしない。
- Google ドキュメント / スライド / スプレッドシート、Word / PowerPoint / Excel もリンクとして貼る。ファイルの添付はしない (保存先が要り、`localStorage` に入らないため)。OneDrive や SharePoint のファイルは URL を貼る。
- アイコンは公式ロゴを使わず、この app 用に描いた形 (文書、スライド、表、Issue、PR) とサービス名で見分ける (AGENTS.md の「外部素材を使わない」と、商標の扱いのため)。

## データ

```ts
interface Project {
  id: string;
  name: string;        // 1〜40文字
  created: number;
  fields: FieldDef[];  // プロジェクトの項目
}
interface FieldDef {
  id: string;
  name: string;        // 1〜30文字
  type: "text" | "number" | "select" | "date" | "checkbox" | "url";
  options?: string[];  // select の選択肢。1つ以上
  onCard: boolean;     // カードに出すか
}
// Task に足したもの
projectId: string;
fields?: Record<string, string | number | boolean>; // 項目の値。キーは FieldDef.id
links?: { id: string; url: string }[];             // 参考資料。10件まで
```

- 保存キー: `tomoshibi.projects` (一覧)、`tomoshibi.project` (いま開いているプロジェクトの id)。
- プロジェクトは常に1つ以上ある。最初に開いたとき、既存のタスクは「My project / 最初のプロジェクト」に入る。所属先のないタスクも最初のプロジェクトに入れる (`ensureProjects()`)。
- 項目を消しても、タスクに残った値はすぐには消さない。そのタスクを次に保存したときに消える。
- 未完了の上限 60件は、プロジェクトごと。

## 画面

### プロジェクトのメニュー (ヘッダー)

| 項目 | 決まり |
|---|---|
| 開き方 | ヘッダーのプロジェクト名のボタン、か `P` |
| 中身 | プロジェクトの一覧 (いまのものに朱の点。未完了の数と、期限切れの数)、「+ New project」、「Project settings…」 |
| 操作 | ↑↓ Home End で移る、Enter で選ぶ、Esc で閉じてボタンに戻る、外を押すと閉じる |
| 見た目 | 和紙に襖の桟。開くときは横に引くように現れる (Safe mode と reduced-motion では動かさない) |
| 開いている間 | 期限判定と気配の演出を止める |
| 切り替え | 看板の中身が入れ替わる。直前の「元に戻す」は消える。スクリーンリーダーに「Now in …」と読み上げる |

### プロジェクトの設定

| 項目 | 決まり |
|---|---|
| 名前 | 必須 |
| 項目 | 名前、種類、カードに出すか、選択肢 (選択肢の種類のとき)。「+ Add field」で足し、× で消す |
| 消す | 長押し (0.9秒)。未完了のタスクがあると消せない (先に完了、移動、燃やす)。完了したタスクは一緒に消える。最後の1つは消せない |

### 登録・編集の画面

- プロジェクトが2つ以上あるとき、一番上に「Project」の選択欄が出る。変えると、そのプロジェクトの項目に入れ替わる。保存すると、タスクはそのプロジェクトへ移る。
- プロジェクトの項目は、担当者と状態の下に2列で並ぶ。数値の欄は `type="number"`、リンクの欄は http(s) だけ受け付ける。
- 「References」にリンクを貼り、Enter か「Add」で足す。入力したまま保存しても足される。`https://` がなければ補う。`javascript:` などは塩のエラー。

### カード

- 「カードに出す」にした項目を `Estimate: 3  Area: Front  ✓ Reviewed` の形で出す。
- リンクは小さな札 (チップ) で出す。新しいタブで開く (`rel="noopener noreferrer"`)。

## リンクの見分け方 (`src/links.ts`)

| URL | 表示 |
|---|---|
| `github.com/{owner}/{repo}/issues/{n}` | GitHub、`repo#n`、Issue の印 (緑) |
| `github.com/{owner}/{repo}/pull/{n}` | GitHub、`repo#n`、PR の印 (紫) |
| `github.com/...` (その他) | GitHub、`owner/repo` |
| `docs.google.com/document` / `presentation` / `spreadsheets` | Google Docs / Slides / Sheets |
| `drive.google.com` | Google Drive |
| SharePoint、OneDrive の `/:w:/` `/:p:/` `/:x:/`、`.docx` `.pptx` `.xlsx`、`app=Word` など | Word / PowerPoint / Excel |
| SharePoint、OneDrive (種類が分からない) | Microsoft 365 |
| その他 | ホスト名と地球の印 |

## 対象外

- GitHub の Issue の取り込み、状態の同期 (サーバーと GitHub App が要る)。
- ファイルの添付 (保存先が要る)。
- 全プロジェクトをまとめて見る画面。
- プロジェクトごとの名簿と役割。

## 最初のプロジェクトの名前

- プロジェクトが1つもないときに作る最初のプロジェクトは、既定の名前 (英語 `My project`、日本語 `最初のプロジェクト`) で作る。
- 名前が既定のどちらかのままなら、表示する言語に合わせて出す (`store.ts` の `projectName`)。作ったときの言語の名前が、言語を切り替えても残らないようにするため。保存されている名前は書き換えない。
- ユーザーが名前を変えたら、その名前をそのまま出す。
