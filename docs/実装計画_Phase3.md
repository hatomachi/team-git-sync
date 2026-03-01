# Team Git Sync: 実装計画 Phase 3 (Implementation Plan)

## Phase 3: 個別Revert機能の実装

Phase 2で作成した右ペインのファイルリストに対して、各アイテム単位で変更を破棄（Revert）する機能を追加します。Gitの知識がなくても「元に戻す」操作として直感的に操作できることを目指します。

### 実装詳細

1. **Revert用UIの追加 (`GitSyncView.ts`)**
   - ファイルリスト (`file of status.files` ループ) の各アイテムの右端に「Revert（元に戻す）」アイコンボタン（`undo` アイコン等）を追加。
   - CSS等を用いて、リストアイテムのレイアウトを調整する。

2. **確認ダイアログの実装 (`src/ui/ConfirmModal.ts` 等)**
   - 誤操作によるデータロストを防ぐため、Revertボタン押下時にObsidianの `Modal` を表示する。
   - 「[ファイル名] の変更を破棄しますか？この操作は元に戻せません。」といった警告文と、「Cancel」「Revert」ボタンを配置する。

3. **Revert処理の実装とGitコマンド連動**
   - 確認ダイアログでRevertが承認されたら、ファイルのステータス（`file.index` または `file.working_dir` など）から、UntrackedかModified/Deletedかを判定。
   - **Modified/Deleted**: 該当ファイルに対して `git checkout -- <filepath>` に相当する処理を実行して変更を取り消す。
   - **Untracked**: `git clean -f -- <filepath>` または Node.jsの `fs` モジュールで対象ファイルを削除する。
   - 完了後、画面右上の Notice で結果を通知し、右ペインのビューを `refreshStatus()` で再描画する。

### 確認手順
1. チームフォルダ内の既存ファイルを編集し、右ペインに表示されることを確認。
2. そのアイテムのRevertボタンを押し、確認ダイアログを経て更新内容が破棄（元の状態に復元）されることを確認。
3. 同じチームフォルダ内に新規ファイルを作成し、右ペインにUntrackedとして表示されることを確認。
4. そのアイテムのRevertボタンを押し、ダイアログを経てファイル自体が削除されることを確認。
