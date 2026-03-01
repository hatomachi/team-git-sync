# Team Git Sync: 実装計画 Phase 5 (Implementation Plan)

## Phase 5: ワンクリック同期（正常系）の実装

右ペインのGit Syncビューに変更ファイルがある場合、それらをリモートリポジトリに反映（Add -> Commit -> Pull/Push）するためのUIと連携処理を実装します。コンフリクトの発生しない正常系フローを対象とします。

### 実装詳細

1. **同期用UIの追加 (`GitSyncView.ts`)**
   - 変更ファイル（`status.files.length > 0`）が存在する場合、プレビュー画面の下部に同期用コンテナを表示。
   - 同期コンテナには以下の要素を配置：
     - `input[type="text"]`（コミットメッセージ入力欄、プレースホルダー: "Commit message (optional)"）
     - `button`（Syncボタン、アイコン: `upload-cloud` 等）

2. **Syncロジックの実装**
   - Syncボタンクリック時に `handleSync(message: string)` を呼び出し。ボタンをDisabledにしてローディング表示に切り替え。
   - 以下の `simple-git` メソッドを順次実行：
     1. `await gitInstance.add('.')`
     2. `const commitMsg = message || "Auto-sync from Obsidian: " + new Date().toLocaleString()`
     3. `await gitInstance.commit(commitMsg)`
     4. `await gitInstance.pull('origin', 'main', {'--rebase': 'true'})` 
        - （※現在のブランチ名を取得して動的に処理するのが望ましいが、MVPとして一旦 `main` を想定、または引数無し `pull()` で tracking branch からPullさせる）
     5. `await gitInstance.push()`
   - 各ステップを `try-catch` で囲み、失敗時にはエラーNoticeを表示し、処理を中断させる。
   - すべて成功したら「Sync Successful」をNoticeで表示し、`refreshStatus()` を呼んで画面を初期化する。

### 確認手順
1. デスクトップ版Obsidian上でチームフォルダ内のノートを編集する。
2. Git SyncビューでSyncボタンとともにメッセージ入力欄が表示されることを確認。
3. 任意のメッセージを入力し Syncボタンを押下。
4. Github等のリモートリポジトリに変更がPushされ、コミットメッセージが反映されていることを確認する。
5. Git Syncビューが「No changes」になることを確認する。
