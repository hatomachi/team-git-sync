import { App, Modal } from "obsidian";
import * as Diff2Html from "diff2html";

export class DiffModal extends Modal {
    filename: string;
    diffString: string;

    constructor(app: App, filename: string, diffString: string) {
        super(app);
        this.filename = filename;
        this.diffString = diffString;
    }

    onOpen() {
        const { contentEl, titleEl } = this;
        titleEl.setText(`Diff: ${this.filename}`);
        this.modalEl.style.width = "80vw";
        this.modalEl.style.height = "80vh";

        if (!this.diffString || this.diffString.trim() === "") {
            contentEl.createEl("p", { text: "No differences found or new uncommitted file." });
            return;
        }

        // CSS is injected via the plugin's styles.css

        try {
            const diffHtml = Diff2Html.html(this.diffString, {
                drawFileList: false,
                matching: "lines",
                outputFormat: "side-by-side",
            });

            const diffContainer = contentEl.createEl("div");
            diffContainer.innerHTML = diffHtml;

            // Make the diff scrollable if it is too large
            diffContainer.style.overflow = "auto";
            diffContainer.style.height = "100%";
            contentEl.style.overflow = "hidden";
            contentEl.style.display = "flex";
            contentEl.style.flexDirection = "column";

        } catch (error) {
            contentEl.createEl("p", {
                text: `Failed to render diff: ${(error as Error).message}`,
                cls: "text-error"
            });
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
