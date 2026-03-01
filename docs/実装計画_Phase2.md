# Team Git Sync: 実装計画 Phase 2 (Implementation Plan)

> **注記:** 本ドキュメントは、AIアシスタントとのセッションをまたいでも実装の前提や計画を参照できるように、`docs` フォルダに保存・更新されるインベントリです。

## Phase 2: 右ペイン（カスタムビュー）とファイルリスト表示

Phase 1で確認したGit連携基盤をもとに、Obsidianの右ペインに変更ファイル一覧を表示するカスタムビュー（`ItemView`）を実装します。

### 実装詳細

1. **`src/views/GitSyncView.ts` の作成**
   - Obsidianの `ItemView` を継承したクラス。
   - UI構造：
     - ヘッダー部：対象チーム（リポジトリ領域）の名前表示 ＋ 「Refresh」アイコンボタン。
     - コンテンツ部：`git.status()` で取得したファイルのリスト（Modified, Added, Deleted などのステータス表示付き）。

2. **`main.ts` への統合**
   - ファイルの先頭でViewを `registerView` する。
   - `addCommand` で「Open Git Sync View」コマンドを登録し、右ペイン（`getRightLeaf`）に展開するロジックを実装。
   - **イベント連携**: ユーザーがクリックしてフォーカスされる（アクティブになる）ファイルが変わったことを検知するため、`this.app.workspace.on('file-open', ...)` を購読。アクティブファイルが属するサブフォルダが変更された場合、右ペインの表示（リポジトリ先）も追従して更新させる。

### 確認手順
1. Obsidianでコマンドパレットから「Open Git Sync View」を実行する。
2. 右ペインに "Git Sync" のタブが開く。
3. Phase 1で変更したファイルがリストアップされていることを確認。
4. 別チームフォルダ（例: `teamB/`）内のファイルを開いた際、右ペインの表示が `teamB` リポジトリのものに切り替わることを確認。
