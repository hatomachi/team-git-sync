# Team Git Sync: 実装計画 Phase 4 (Implementation Plan)

## Phase 4: Visual Diff モーダルの実装

Phase 2で作ったファイルリストの名前部分をクリックした際、対象ファイルのローカルでの変更内容（Git diff）をGitHubライクな視覚的な形式で表示するモーダル画面を実装します。

### 実装詳細

1. **パッケージの追加**
   - ターミナルで `npm install diff2html` および `npm install -D @types/diff2html` を実行し、パッケージを追加します。

2. **Diff表示モーダル (`src/ui/DiffModal.ts`) の作成**
   - Obsidianの `Modal` クラスを継承。
   - `onOpen` メソッド内で、渡されたGitプレーンDiff（Raw text）を `diff2html` の `html(diffString, configuration)` を用いてHTML化し、`contentEl` へ挿入します。
   - Obsidian環境内で `diff2html` のデフォルトデザインを適用させるため、`diff2html/bundles/css/diff2html.min.css` のスタイル（文字列化して定数に保持、またはプラグイン全体の `styles.css` に同梱する手法）をインジェクションします。

3. **`GitSyncView.ts` へのイベント追加**
   - ファイル名の `span` 要素 (`nameEl`) に対し、`cursor: pointer` といったスタイル付与や、`mouseenter/mouseleave` 等によるホバー視覚効果を実装します。
   - `onclick` イベントを追加：
     - `gitInstance.diff(['--', file.path])` を呼び出してRaw Diffを取得。
     - *※新規作成ファイル（Untracked）の場合は `git diff` で出力が出ないケースがあるため、その場合はファイルの中身をすべて `+` 差分にするか、「新規ファイルです」というプレースホルダーを表示するなどのフォールバック処理を考慮する。*
     - 取得したDiffを `DiffModal` に引き渡して `open()` する。

### 確認手順
1. デスクトップ版Obsidian上で、チームフォルダ内のノートに文字を追加・削除します。
2. 右ペインのGit Syncビューで、対象ノートのファイル名をクリック。
3. Diffモーダルが立ち上がり、左右スタイル（または一行スタイル）で追加・削除行が分かりやすく色付き表示されることを確認します。
