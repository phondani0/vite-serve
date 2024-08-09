import { exec } from "child_process";
import * as vscode from "vscode";
import {
    combinePackageJson,
    createHtmlEntryFile,
    createTempDirectory,
    createViteConfig,
    installViteInTempDir,
    symlinkOrCopyProjectFiles,
} from "./utils";

function startViteServer(tempDir: string): void {
    exec("npx vite", { cwd: tempDir }, (error, stdout, stderr) => {
        if (error) {
            console.error(`Vite error: ${stderr}`);
            vscode.window.showInformationMessage("Vite error:", stderr);
            return;
        }
    });
}

const runWithVite = async () => {
    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (!workspaceFolders) {
        return vscode.window.showErrorMessage("No workspace folder found.");
    }

    const projectPath = workspaceFolders[0].uri.fsPath;

    const tempDir = createTempDirectory();

    vscode.window.showInformationMessage(projectPath);

    try {
        await installViteInTempDir(tempDir);
        symlinkOrCopyProjectFiles(projectPath, tempDir);
        combinePackageJson(projectPath, tempDir);

        vscode.window.showInformationMessage("Installing dependencies...");

        // @TODO: Optimize this.
        exec("npm install", { cwd: tempDir }, (error, stdout, stderr) => {
            if (error) {
                throw error;
            }

            createViteConfig(tempDir, projectPath);
            createHtmlEntryFile(tempDir);
            startViteServer(tempDir);

            vscode.window.showInformationMessage(
                "React app is running with Vite!"
            );
        });
    } catch (error) {
        vscode.window.showErrorMessage(
            "Failed to run the React app with Vite."
        );
    }
};

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand(
        "vite-serve.runWithVite",
        runWithVite
    );

    context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
