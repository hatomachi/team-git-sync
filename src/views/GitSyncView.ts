import { ItemView, WorkspaceLeaf, Notice, setIcon, App } from "obsidian";
import TeamGitSyncPlugin from "../../main";
import { ConfirmModal } from "../ui/ConfirmModal";
import { DiffModal } from "../ui/DiffModal";

export const GIT_SYNC_VIEW_TYPE = "team-git-sync-view";

export class GitSyncView extends ItemView {
    plugin: TeamGitSyncPlugin;

    constructor(leaf: WorkspaceLeaf, plugin: TeamGitSyncPlugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType(): string {
        return GIT_SYNC_VIEW_TYPE;
    }

    getDisplayText(): string {
        return "Git Sync";
    }

    getIcon(): string {
        return "git-compare";
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();

        const viewContainer = container.createEl("div");
        viewContainer.style.display = "flex";
        viewContainer.style.flexDirection = "column";
        viewContainer.style.height = "100%";

        // Header area
        const headerEl = viewContainer.createEl("div", { cls: "team-git-sync-header" });
        headerEl.style.display = "flex";
        headerEl.style.justifyContent = "space-between";
        headerEl.style.alignItems = "center";
        headerEl.style.padding = "10px";
        headerEl.style.borderBottom = "1px solid var(--background-modifier-border)";

        const titleEl = headerEl.createEl("h4", { text: "No Active Team Repo" });
        titleEl.style.margin = "0";

        const refreshBtn = headerEl.createEl("button", { cls: "clickable-icon" });
        setIcon(refreshBtn, "refresh-cw");
        refreshBtn.title = "Refresh Status";
        refreshBtn.onclick = () => this.refreshStatus();

        // Content area
        const contentEl = viewContainer.createEl("div", { cls: "team-git-sync-content" });
        contentEl.style.padding = "10px";
        contentEl.style.flex = "1";
        contentEl.style.overflowY = "auto";

        // Initial render
        await this.renderStatus(contentEl, titleEl);
    }

    async onClose() {
        // Cleanup if needed
    }

    async refreshStatus() {
        const container = this.containerEl.children[1];
        const titleEl = container.querySelector("h4");
        const contentEl = container.querySelector(".team-git-sync-content") as HTMLElement;

        if (contentEl && titleEl) {
            await this.renderStatus(contentEl, titleEl);
        }
    }

    private async renderStatus(contentEl: HTMLElement, titleEl: HTMLElement) {
        contentEl.empty();

        const gitInstance = this.plugin.getGitForCurrentFile();
        if (!gitInstance) {
            titleEl.textContent = "No Repo Selected";
            contentEl.createEl("p", {
                text: "Please open a file located within a team's Git folder to see its sync status.",
                cls: "text-muted"
            });
            return;
        }

        // Update title - We don't have direct access to _baseDir safely, 
        // so we'll just indicate we're looking at the current active file's repo.
        const activeFile = this.plugin.app.workspace.getActiveFile();
        const teamFolder = activeFile ? activeFile.path.split('/')[0] : "Unknown";
        titleEl.textContent = `Repo: ${teamFolder}`;

        new Notice("Refreshing Git Status...");
        const loadingEl = contentEl.createEl("div", { text: "Loading Git status..." });

        try {
            const status = await gitInstance.status();
            loadingEl.remove();

            const hasChanges = status.files.length > 0;
            const hasUnpushed = status.ahead > 0;

            if (!hasChanges && !hasUnpushed) {
                contentEl.createEl("p", {
                    text: "No changes. You are up to date.",
                    cls: "text-success"
                });
                return;
            }

            if (hasUnpushed) {
                const warnEl = contentEl.createEl("div", {
                    cls: "team-git-sync-warning"
                });
                warnEl.style.padding = "10px";
                warnEl.style.backgroundColor = "rgba(255, 150, 0, 0.2)";
                warnEl.style.border = "1px solid rgba(255, 150, 0, 0.5)";
                warnEl.style.borderRadius = "4px";
                warnEl.style.marginBottom = "10px";
                warnEl.style.color = "var(--text-normal)";
                warnEl.textContent = `⚠️ 未Pushのコミットが ${status.ahead} 件あります`;
            }

            if (hasChanges) {
                const listEl = contentEl.createEl("ul");
                listEl.style.listStyleType = "none";
                listEl.style.padding = "0";
                listEl.style.margin = "0";

                for (const file of status.files) {
                    const itemEl = listEl.createEl("li");
                    itemEl.style.padding = "6px 0";
                    itemEl.style.borderBottom = "1px solid var(--background-modifier-border)";
                    itemEl.style.display = "flex";
                    itemEl.style.alignItems = "center";
                    itemEl.style.gap = "8px";

                    // Status badge
                    const badgeEl = itemEl.createEl("span", { text: file.working_dir || file.index });
                    badgeEl.style.fontSize = "0.7em";
                    badgeEl.style.padding = "2px 4px";
                    badgeEl.style.borderRadius = "4px";
                    badgeEl.style.backgroundColor = "var(--text-accent)";
                    badgeEl.style.color = "var(--text-on-accent)";
                    badgeEl.style.flexShrink = "0";

                    // Filename
                    const nameEl = itemEl.createEl("span", { text: file.path });
                    nameEl.style.flexGrow = "1";
                    nameEl.style.wordBreak = "break-all";
                    nameEl.style.cursor = "pointer";
                    nameEl.style.textDecoration = "underline";
                    nameEl.onclick = () => this.showDiff(file.path, file.working_dir || file.index);

                    // Revert Button
                    const revertBtn = itemEl.createEl("button", { cls: "clickable-icon" });
                    setIcon(revertBtn, "undo-2");
                    revertBtn.title = "Revert changes";
                    revertBtn.style.flexShrink = "0";
                    revertBtn.onclick = () => this.handleRevert(file.path, file.working_dir || file.index);
                }
            }

            // Sync UI Container
            const syncUIEl = contentEl.createEl("div", { cls: "team-git-sync-actions" });
            syncUIEl.style.marginTop = "20px";
            syncUIEl.style.display = "flex";
            syncUIEl.style.flexDirection = "column";
            syncUIEl.style.gap = "10px";
            syncUIEl.style.borderTop = "1px solid var(--background-modifier-border)";
            syncUIEl.style.paddingTop = "15px";

            // Row for input and button
            const syncRow = syncUIEl.createEl("div");
            syncRow.style.display = "flex";
            syncRow.style.gap = "10px";

            const msgInput = syncRow.createEl("input", { type: "text" });
            msgInput.placeholder = "Commit message (optional)";
            msgInput.style.flex = "1";
            msgInput.onkeydown = (e) => {
                if (e.key === "Enter") {
                    this.handleSync(msgInput.value, syncUIEl);
                }
            };

            const syncBtn = syncRow.createEl("button", { cls: "mod-cta" });
            syncBtn.style.display = "flex";
            syncBtn.style.alignItems = "center";
            syncBtn.style.gap = "5px";

            const syncIconEl = syncBtn.createEl("span");
            setIcon(syncIconEl, "upload-cloud");
            syncBtn.createEl("span", { text: "Sync" });

            syncBtn.onclick = () => {
                syncBtn.blur();
                this.handleSync(msgInput.value, syncUIEl);
            };

        } catch (error) {
            loadingEl.remove();
            contentEl.createEl("p", {
                text: `Error getting status: ${(error as Error).message}`,
                cls: "text-error"
            });
        }
    }

    private async handleRevert(filePath: string, fileStatus: string) {
        const gitInstance = this.plugin.getGitForCurrentFile();
        if (!gitInstance) return;

        const modal = new ConfirmModal(
            this.app,
            "Revert Changes",
            `Are you sure you want to revert changes to "${filePath}"? This action cannot be undone.`,
            async () => {
                try {
                    if (fileStatus === '?' || fileStatus === 'A') {
                        // Untracked or just added - remove the file
                        // Alternatively, we could just checkout if it's 'A', but clean is safer for untracked '?'
                        const fsAdapter = this.plugin.app.vault.adapter as any;
                        const activeFile = this.plugin.app.workspace.getActiveFile();
                        const teamFolder = activeFile ? activeFile.path.split('/')[0] : "";

                        const vaultPath = `${teamFolder}/${filePath}`;
                        const file = this.plugin.app.vault.getAbstractFileByPath(vaultPath);
                        if (file) {
                            await this.plugin.app.vault.trash(file, true);
                        } else {
                            // Fallback if Obsidian API doesn't find it yet
                            await gitInstance.clean('f', ['--', filePath]);
                        }
                    } else {
                        // Modified or Deleted - Checkout from index/HEAD
                        await gitInstance.checkout(['--', filePath]);
                    }
                    new Notice(`Reverted ${filePath}`);
                    await this.refreshStatus();
                } catch (error) {
                    console.error("Revert error:", error);
                    new Notice(`Failed to revert ${filePath}: ${(error as Error).message}`);
                }
            }
        );
        modal.open();
    }

    private async showDiff(filePath: string, fileStatus: string) {
        const gitInstance = this.plugin.getGitForCurrentFile();
        if (!gitInstance) return;

        let diffText = "";
        try {
            if (fileStatus === '?' || fileStatus === 'A') {
                // Untracked or added
                diffText = await gitInstance.diff(['--', filePath]);
                if (!diffText && fileStatus === '?') {
                    diffText = `File is untracked. All contents are new.`;
                }
            } else {
                // Modified or deleted
                diffText = await gitInstance.diff(['--', filePath]);
            }

            const modal = new DiffModal(this.app, filePath, diffText);
            modal.open();
        } catch (error) {
            console.error("Diff error:", error);
            new Notice(`Failed to load diff for ${filePath}: ${(error as Error).message}`);
        }
    }

    private async handleSync(commitMessage: string, syncUIEl?: HTMLElement) {
        const gitInstance = this.plugin.getGitForCurrentFile();
        if (!gitInstance) return;

        // UI elements for status and error
        let syncBtn: HTMLButtonElement | null = null;
        let syncStatusEl: HTMLElement | null = null;
        if (syncUIEl) {
            syncBtn = syncUIEl.querySelector("button") as HTMLButtonElement | null;
            if (syncBtn) syncBtn.disabled = true;

            syncStatusEl = syncUIEl.querySelector(".sync-status") as HTMLElement | null;
            if (!syncStatusEl) {
                syncStatusEl = syncUIEl.createEl("div", { cls: "sync-status", text: "" });
                syncStatusEl.style.fontWeight = "bold";
                syncStatusEl.style.color = "var(--text-accent)";
            }
            
            // Clear previous error
            const existingError = syncUIEl.querySelector(".sync-error");
            if (existingError) existingError.remove();
        }

        const updateStatus = (msg: string) => {
            if (syncStatusEl) syncStatusEl.textContent = msg;
        };

        const showError = (msg: string) => {
            if (syncStatusEl) syncStatusEl.textContent = "";
            if (syncUIEl) {
                const errorEl = syncUIEl.createEl("div", { cls: "sync-error" });
                errorEl.style.padding = "10px";
                errorEl.style.backgroundColor = "var(--background-modifier-error)";
                errorEl.style.color = "var(--text-on-accent)";
                errorEl.style.borderRadius = "4px";
                errorEl.style.marginTop = "10px";
                errorEl.textContent = `❌ Error: ${msg}`;
            }
        };

        const notice = new Notice("Syncing...", 0); // Keep open until finished

        try {
            updateStatus("🔄 Checking status...");
            const status = await gitInstance.status();
            const hasChanges = status.files.length > 0;

            if (hasChanges) {
                updateStatus("🔄 Adding & Committing...");
                await gitInstance.add('.');
                const msg = commitMessage.trim() || `Auto-sync from Obsidian: ${new Date().toLocaleString()}`;
                await gitInstance.commit(msg);
            } else {
                updateStatus("🔄 No changes to commit. Proceeding to Pull/Push.");
            }

            try {
                updateStatus("🔄 Pulling...");
                await gitInstance.pull('origin', 'main', { '--no-rebase': null });
            } catch (pullErr) {
                const pullStatus = await gitInstance.status();
                if (pullStatus.conflicted.length > 0) {
                    notice.setMessage("Resolving conflicts...");
                    updateStatus("🔄 Resolving conflicts...");
                    await this.resolveConflicts(gitInstance);
                    new Notice("競合が発生しました。あなたの変更は '_conflict' ファイルとして退避されました。", 10000);
                } else {
                    throw new Error(`Pull failed: ${pullErr}`);
                }
            }

            updateStatus("🔄 Pushing...");
            await gitInstance.push();

            updateStatus("✅ Sync Successful!");
            notice.hide();
            new Notice("Sync Successful!");

            // Refresh view
            await this.refreshStatus();

        } catch (error) {
            notice.hide();
            console.error("Sync error:", error);
            showError((error as Error).message);
            new Notice(`Sync failed: ${(error as Error).message}`, 10000);
            if (syncBtn) syncBtn.disabled = false;
        }
    }

    private async resolveConflicts(gitInstance: any) {
        const status = await gitInstance.status();
        const conflictedFiles = status.conflicted;

        const activeFile = this.plugin.app.workspace.getActiveFile();
        const teamFolder = activeFile ? activeFile.path.split('/')[0] : "";

        // moment is globally available in Obsidian
        const timestamp = (window as any).moment().format("YYYYMMDD_HHmmss");

        for (const filePath of conflictedFiles) {
            try {
                // Get our local version from stage 2 (ours)
                const localContent = await gitInstance.show([`:2:${filePath}`]);

                // Create backup file path
                const fileParts = filePath.split('.');
                const ext = fileParts.length > 1 ? fileParts.pop() : "md";
                const baseName = fileParts.join('.');
                const backupName = `${baseName}_conflict_${timestamp}.${ext}`;
                const backupVaultPath = `${teamFolder}/${backupName}`;

                // Save our local changes to the backup file
                await this.plugin.app.vault.create(backupVaultPath, localContent);

                // Discard our local changes in the original file and accept theirs (remote)
                await gitInstance.checkout(['--theirs', filePath]);

                // Mark the conflict as resolved
                await gitInstance.add([filePath]);

            } catch (err) {
                console.error(`Failed to resolve conflict for ${filePath}`, err);
            }
        }

        // Add the newly created backup files to git
        await gitInstance.add('.');

        // Complete the merge commit
        await gitInstance.commit("Resolve merge conflict: backup local changes and accept theirs");
    }
}
