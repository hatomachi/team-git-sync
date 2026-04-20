import { Plugin, Notice, FileSystemAdapter, WorkspaceLeaf } from 'obsidian';
import { simpleGit, SimpleGit } from 'simple-git';
import * as path from 'path';
import { GitSyncView, GIT_SYNC_VIEW_TYPE } from './src/views/GitSyncView';

export default class TeamGitSyncPlugin extends Plugin {
    git: SimpleGit;

    async onload() {
        console.log('Loading Team Git Sync plugin');

        // Register the custom view
        this.registerView(
            GIT_SYNC_VIEW_TYPE,
            (leaf) => new GitSyncView(leaf, this)
        );

        // Add command to open the view
        this.addCommand({
            id: 'open-git-sync-view',
            name: 'Open Git Sync View',
            callback: () => {
                this.activateView();
            }
        });

        // Listen to file open event to auto-refresh the view if it's open
        this.registerEvent(
            this.app.workspace.on('file-open', () => {
                this.refreshViewIfOpen();
            })
        );

        // Add a test command for git status
        this.addCommand({
            id: 'test-git-status',
            name: 'Test Git Status',
            callback: async () => {
                const gitInstance = this.getGitForCurrentFile();
                if (!gitInstance) {
                    return;
                }

                try {
                    const status = await gitInstance.status();
                    console.log('Git Status:', status);
                    new Notice(`Git Status: ${status.files.length} files changed`);
                } catch (error) {
                    console.error('Git status error:', error);
                    new Notice(`Git Status Error: ${(error as Error).message} `);
                }
            }
        });
    }

    async activateView() {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(GIT_SYNC_VIEW_TYPE);

        if (leaves.length > 0) {
            // A leaf with our view already exists, use that
            leaf = leaves[0];
        } else {
            // Our view could not be found in the workspace, create a new leaf
            // in the right sidebar for it
            const rightLeaf = workspace.getRightLeaf(false);
            if (rightLeaf) {
                leaf = rightLeaf;
                await leaf.setViewState({ type: GIT_SYNC_VIEW_TYPE, active: true });
            }
        }

        // "Reveal" the leaf in case it is in a collapsed sidebar
        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }

    refreshViewIfOpen() {
        const { workspace } = this.app;
        const leaves = workspace.getLeavesOfType(GIT_SYNC_VIEW_TYPE);
        if (leaves.length > 0) {
            const view = leaves[0].view;
            if (view instanceof GitSyncView) {
                view.refreshStatus();
            }
        }
    }

    getGitForCurrentFile(): SimpleGit | null {
        const activeFile = this.app.workspace.getActiveFile();
        if (!activeFile) {
            // We might be just switching workspaces, don't popup notice automatically on file open
            return null;
        }

        // activeFile.path is something like "teamA/Knowledge/Note1.md"
        const parts = activeFile.path.split('/');
        if (parts.length < 2) {
            // Don't show notice silently either during file-open
            return null;
        }
        const teamFolder = parts[0]; // e.g., 'teamA'

        const adapter = this.app.vault.adapter;
        if (adapter instanceof FileSystemAdapter) {
            const basePath = adapter.getBasePath();
            const repoPath = path.join(basePath, teamFolder);
            return simpleGit(repoPath);
        } else {
            return null;
        }
    }

    async getAllGitRepos(): Promise<Array<{ folderName: string, gitInstance: SimpleGit }>> {
        const adapter = this.app.vault.adapter;
        if (!(adapter instanceof FileSystemAdapter)) {
            return [];
        }

        const basePath = adapter.getBasePath();
        const listResult = await adapter.list('/');
        const repos: Array<{ folderName: string, gitInstance: SimpleGit }> = [];

        for (const folder of listResult.folders) {
            // Check if .git exists in the folder
            const exists = await adapter.exists(`${folder}/.git`);
            if (exists) {
                repos.push({
                    folderName: folder,
                    gitInstance: simpleGit(path.join(basePath, folder))
                });
            }
        }

        // Alphabetical sort for consistent UI updates
        repos.sort((a, b) => a.folderName.localeCompare(b.folderName));
        return repos;
    }
    onunload() {
        console.log('Unloading Team Git Sync plugin');
    }
}
