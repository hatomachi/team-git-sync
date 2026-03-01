# Team Git Sync: 実装計画 Phase 6 (Implementation Plan)

## Phase 6: 競合解決ロジック（自動別名退避マージ）の実装

Git操作の障壁となる「Merge Conflict（競合）」エラー発生時に、処理を強制終了してユーザーに手動対応を強いるのではなく、ローカル側の変更を自動的に `_conflict` 付きの新しいファイルとして吐き出し、オリジナルのファイルはリモートの内容で安全に上書きすることで自動マージさせる「競合時のセーフティネット」機能を実装します。

### 実装詳細

1. **`GitSyncView.ts` におけるSyncフローの改修**
   - 現在の `git.pull({ '--rebase': 'true' })` ではコンフリクトが発生した場合にRebaseモードに入ってしまい、`git.status` や `checkout --theirs` などの処理が煩雑になるため、標準のMerge方式である `git.pull('origin', 'main', { '--no-rebase': 'true' })` に変更します。
   - `pull` 時の `try-catch` 内で、コンフリクト発生の例外が出た場合、特別な関数 `resolveConflicts(gitInstance)` へ処理を移譲します。

2. **`resolveConflicts(gitInstance)` ロジックの構築**
   - **状態把握**: `const status = await gitInstance.status()` を呼び、`status.conflicted` 配列でコンフリクトしたファイル群のリストを取得。
   - コンフリクトしたファイル（例: `teamA/Note.md`）ごとに以下の手順をループで実行します：
     - **自分の変更の救出**: `const localContent = await gitInstance.show(['HEAD:' + filePath])` で手元の最新コミット時点の文字列データを抽出。
     - **退避用ファイルの作成**: ファイル名にタイムスタンプ等を付与し（例: `Note_conflict_20260226_120000.md`）、Obsidianの `Vault` API (`this.app.vault.create(...)`) を使って新規作成。
     - **競合の解消（相手の変更を採用）**: `await gitInstance.checkout(['--theirs', filePath])` を実行し、ファイル自体は相手(リモート)の最新状態に戻す。
     - `await gitInstance.add([filePath])` でコンフリクトを「解決済（Resolved）」としてステージングに追加。
   - **マージ完了**: すべてのループが終わったら、退避した新規ファイルも含めるために `await gitInstance.add('.')` を実行し、`await gitInstance.commit("Auto-merge: saved conflicts as new files")` でマージの中断状態を抜ける。
   - **フローへの復帰**: 解決が成功したら無事 `git.push()` に移行するようメインロジックに戻る。

3. **ユーザへのフィードバック強化**
   - コンフリクトが発生し、解決された際には通常の成功通知ではなく、「Notice: 競合が発生しました。あなたの変更は〜という名前で保存されました」とわかりやすく警告表示を出すことで、手動での目視・転記（マージ）が必要であることをアピールする。

### 確認手順
1. Obsidianと同じチームフォルダにあるGitリポジトリ（ターミナル等）から、あるファイルに対してリモートにPush済みの変更を加えます。
2. 同時にObsidian上でも同じファイルの同じ行を編集します。
3. Obsidian上で「Sync」ボタンをクリックします。
4. 裏側でコンフリクトが発生し、自動解決処理が走ったのち、ファイル名の末尾に `_conflict` が付加された別ファイルが出現することを確認します。
5. リモートリポジトリへ無事Pushが完了することを確認します。
