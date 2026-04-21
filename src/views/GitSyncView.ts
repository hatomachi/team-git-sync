import { ItemView, WorkspaceLeaf, Notice, setIcon, App } from "obsidian";
import TeamGitSyncPlugin from "../../main";
import { ConfirmModal } from "../ui/ConfirmModal";
import { DiffModal } from "../ui/DiffModal";
import { SimpleGit } from "simple-git";
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
        titleEl.textContent = "All Repositories";

        const loadingEl = contentEl.createEl("div", { text: "Locating repositories..." });

        try {
            const repos = await this.plugin.getAllGitRepos();
            loadingEl.remove();

            if (repos.length === 0) {
                contentEl.createEl("p", {
                    text: "No Git repositories found at the vault root.",
                    cls: "text-muted"
                });
                return;
            }

            for (const repo of repos) {
                // Kick off render independently so they don't block each other
                this.renderRepoSection(contentEl, repo.folderName, repo.gitInstance);
            }
        } catch (error) {
            loadingEl.remove();
            contentEl.createEl("p", {
                text: `Error scanning repositories: ${(error as Error).message}`,
                cls: "text-error"
            });
        }
    }

    private async renderRepoSection(containerEl: HTMLElement, folderName: string, gitInstance: SimpleGit) {
        // Create section container
        const sectionEl = containerEl.createEl("div", { cls: "repo-section" });
        sectionEl.style.border = "1px solid var(--background-modifier-border)";
        sectionEl.style.borderRadius = "6px";
        sectionEl.style.padding = "10px";
        sectionEl.style.marginBottom = "15px";

        // Header
        const headerEl = sectionEl.createEl("h5", { text: folderName });
        headerEl.style.margin = "0 0 10px 0";
        headerEl.style.fontWeight = "bold";

        const contentEl = sectionEl.createEl("div");

        const statusLoadingEl = contentEl.createEl("div", { text: "Loading status...", cls: "text-muted" });

        try {
            await gitInstance.fetch();
            const status = await gitInstance.status();
            statusLoadingEl.remove();

            const hasChanges = status.files.length > 0;
            const hasUnpushed = status.ahead > 0;
            const hasUnpulled = status.behind > 0;

            if (!hasChanges && !hasUnpushed && !hasUnpulled) {
                contentEl.createEl("p", {
                    text: "No changes. You are up to date.",
                    cls: "text-success",
                });
                contentEl.lastElementChild?.setAttribute("style", "margin: 0;");
                return;
            }

            if (hasUnpulled) {
                const warnEl = contentEl.createEl("div", {
                    cls: "team-git-sync-warning"
                });
                warnEl.style.padding = "8px";
                warnEl.style.backgroundColor = "rgba(0, 150, 255, 0.2)";
                warnEl.style.border = "1px solid rgba(0, 150, 255, 0.5)";
                warnEl.style.borderRadius = "4px";
                warnEl.style.marginBottom = "10px";
                warnEl.style.color = "var(--text-normal)";
                warnEl.textContent = `⬇️ リモートに ${status.behind} 件の更新があります（未Pull）`;
            }

            if (hasUnpushed) {
                const warnEl = contentEl.createEl("div", {
                    cls: "team-git-sync-warning"
                });
                warnEl.style.padding = "8px";
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

                    const badgeEl = itemEl.createEl("span", { text: file.working_dir || file.index });
                    badgeEl.style.fontSize = "0.7em";
                    badgeEl.style.padding = "2px 4px";
                    badgeEl.style.borderRadius = "4px";
                    badgeEl.style.backgroundColor = "var(--text-accent)";
                    badgeEl.style.color = "var(--text-on-accent)";
                    badgeEl.style.flexShrink = "0";

                    const nameEl = itemEl.createEl("span", { text: file.path });
                    nameEl.style.flexGrow = "1";
                    nameEl.style.wordBreak = "break-all";
                    nameEl.style.cursor = "pointer";
                    nameEl.style.textDecoration = "underline";
                    nameEl.onclick = () => this.showDiff(gitInstance, file.path, file.working_dir || file.index);

                    const revertBtn = itemEl.createEl("button", { cls: "clickable-icon" });
                    setIcon(revertBtn, "undo-2");
                    revertBtn.title = "Revert changes";
                    revertBtn.style.flexShrink = "0";
                    revertBtn.onclick = () => this.handleRevert(folderName, gitInstance, file.path, file.working_dir || file.index);
                }
            }

            // Sync UI Container
            const syncUIEl = contentEl.createEl("div", { cls: "team-git-sync-actions" });
            syncUIEl.style.marginTop = "15px";
            syncUIEl.style.display = "flex";
            syncUIEl.style.flexDirection = "column";
            syncUIEl.style.gap = "10px";
            syncUIEl.style.borderTop = "1px solid var(--background-modifier-border)";
            syncUIEl.style.paddingTop = "10px";

            const syncRow = syncUIEl.createEl("div");
            syncRow.style.display = "flex";
            syncRow.style.gap = "10px";

            const msgInput = syncRow.createEl("input", { type: "text" });
            msgInput.placeholder = "Commit message";
            msgInput.style.flex = "1";
            msgInput.onkeydown = (e) => {
                if (e.key === "Enter") {
                    this.handleSync(folderName, gitInstance, msgInput.value, syncUIEl);
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
                this.handleSync(folderName, gitInstance, msgInput.value, syncUIEl);
            };

        } catch (error) {
            statusLoadingEl.remove();
            contentEl.createEl("p", {
                text: `Error getting status: ${(error as Error).message}`,
                cls: "text-error"
            });
        }
    }

    private async handleRevert(folderName: string, gitInstance: SimpleGit, filePath: string, fileStatus: string) {
        const modal = new ConfirmModal(
            this.app,
            "Revert Changes",
            `Are you sure you want to revert changes to "${filePath}" in repo "${folderName}"? This action cannot be undone.`,
            async () => {
                try {
                    if (fileStatus === '?' || fileStatus === 'A') {
                        // Untracked or just added - remove the file
                        const vaultPath = `${folderName}/${filePath}`;
                        const file = this.plugin.app.vault.getAbstractFileByPath(vaultPath);
                        if (file) {
                            await this.plugin.app.vault.trash(file, true);
                        } else {
                            await gitInstance.clean('f', ['--', filePath]);
                        }
                    } else {
                        // Modified or Deleted - Checkout from index/HEAD
                        await gitInstance.checkout(['--', filePath]);
                    }
                    new Notice(`Reverted ${filePath} in ${folderName}`);
                    await this.refreshStatus();
                } catch (error) {
                    console.error("Revert error:", error);
                    new Notice(`Failed to revert ${filePath}: ${(error as Error).message}`);
                }
            }
        );
        modal.open();
    }

    private async showDiff(gitInstance: SimpleGit, filePath: string, fileStatus: string) {
        let diffText = "";
        try {
            if (fileStatus === '?' || fileStatus === 'A') {
                diffText = await gitInstance.diff(['--', filePath]);
                if (!diffText && fileStatus === '?') {
                    diffText = `File is untracked. All contents are new.`;
                }
            } else {
                diffText = await gitInstance.diff(['--', filePath]);
            }

            const modal = new DiffModal(this.app, filePath, diffText);
            modal.open();
        } catch (error) {
            console.error("Diff error:", error);
            new Notice(`Failed to load diff for ${filePath}: ${(error as Error).message}`);
        }
    }

    private async handleSync(folderName: string, gitInstance: SimpleGit, commitMessage: string, syncUIEl?: HTMLElement) {
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

        const notice = new Notice(`Syncing ${folderName}...`, 0);

        try {
            updateStatus("🔄 Checking status...");
            const status = await gitInstance.status();
            
            const currentBranch = status.current;
            if (!currentBranch) {
                throw new Error("現在のブランチを特定できません（Detached HEAD状態の可能性があります）。");
            }

            let remoteBranchName = currentBranch;
            try {
                const upstream = await gitInstance.revparse(['--abbrev-ref', '@{u}']);
                if (upstream && typeof upstream === 'string' && upstream.includes('/')) {
                    const parts = upstream.split('/');
                    remoteBranchName = parts.slice(1).join('/');
                }
            } catch (e) {
                console.debug(`Upstream branch fetch failed, using local branch: ${currentBranch}`);
            }

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
                updateStatus(`🔄 Pulling (${remoteBranchName})...`);
                await gitInstance.pull('origin', remoteBranchName, { '--no-rebase': null });
            } catch (pullErr) {
                const pullStatus = await gitInstance.status();
                if (pullStatus.conflicted.length > 0) {
                    notice.setMessage("Resolving conflicts...");
                    updateStatus("🔄 Resolving conflicts...");
                    await this.resolveConflicts(folderName, gitInstance);
                    new Notice("競合が発生しました。あなたの変更は '_conflict' ファイルとして退避されました。", 10000);
                } else {
                    throw new Error(`Pull failed: ${pullErr}`);
                }
            }

            updateStatus(`🔄 Pushing (${currentBranch})...`);
            await gitInstance.push('origin', currentBranch);

            updateStatus("✅ Sync Successful!");
            notice.hide();
            new Notice(`Sync Successful for ${folderName}!`);

            await this.refreshStatus();

        } catch (error) {
            notice.hide();
            console.error(`Sync error in ${folderName}:`, error);
            showError((error as Error).message);
            new Notice(`Sync failed for ${folderName}: ${(error as Error).message}`, 10000);
            if (syncBtn) syncBtn.disabled = false;
        }
    }

    private async resolveConflicts(folderName: string, gitInstance: SimpleGit) {
        const status = await gitInstance.status();
        const conflictedFiles = status.conflicted;

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
                const backupVaultPath = `${folderName}/${backupName}`;

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
        await gitInstance.commit("Resolve merge conflict: backup local changes and accept theirs");
    }
}
