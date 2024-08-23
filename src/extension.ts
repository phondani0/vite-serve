import { exec } from "child_process";
import * as vscode from "vscode";
import * as os from "os";
import treeKill from "tree-kill";

import {
    combineDependencies,
    createHtmlEntryFile,
    createTempDirectory,
    createViteConfig,
    symlinkOrCopyProjectFiles,
} from "./utils";

let statusBarItem: vscode.StatusBarItem;
let viteRunnerProcessId: number | null;

function startViteServer(tempDir: string): void {
    const processInstance = exec(
        "npx vite",
        { cwd: tempDir },
        (error, stdout, stderr) => {
            if (error) {
                console.error(`Vite error: ${stderr}`);
                vscode.window.showInformationMessage("Vite error:", stderr);
                return;
            }
        }
    );

    // Update process id of the process which is running `npx vite`, which will be the parent process of the vite server
    viteRunnerProcessId = processInstance.pid || null;
}

const runWithVite = async (tempDir: string, projectPath: string) => {
    try {
        vscode.window.showInformationMessage("Preparing Vite environment...");

        statusBarItem.text = "$(sync~spin) Vite Serve: In Progress...";
        statusBarItem.backgroundColor = new vscode.ThemeColor(
            "statusBarItem.warningBackground"
        );
        statusBarItem.show();

        symlinkOrCopyProjectFiles(projectPath, tempDir);
        combineDependencies(projectPath, tempDir);
        createViteConfig(tempDir, projectPath);
        createHtmlEntryFile(tempDir, projectPath);

        vscode.window.showInformationMessage(
            `Installing Vite and related plugins, this is one time process, Please wait...`
        );
        // @TODO: Optimize this.
        exec(
            "npm install --legacy-peer-deps",
            { cwd: tempDir },
            (error, stdout, stderr) => {
                if (error) {
                    throw error;
                }

                startViteServer(tempDir);
                statusBarItem.text = "$(primitive-square) Stop Vite Serve";
                statusBarItem.backgroundColor = new vscode.ThemeColor(
                    "statusBarItem.errorBackground"
                );

                // @TODO: Include the PORT info.
                vscode.window.showInformationMessage(
                    "Successfully started the app with Vite!"
                );
            }
        );
    } catch (error) {
        vscode.window.showErrorMessage(
            "Failed to start the Vite development server."
        );

        statusBarItem.hide();
    }
};

export function activate(context: vscode.ExtensionContext) {
    // Create a cache object to store temp directories for each project
    // This cache will be reinitialized every time the extension is activated
    // If the VS Code window is closed and reopened with a new project, the cache will be reinitialized
    // But if a new project is opened in the same VS Code window, the cache will not be reinitialized thats why we are using the cache object based on the projectPath.

    // We can reuse the temp directory if it is already there, otherwise we have to do install all the dependencies again, which might take significant amount of time.
    const tempDirCache: { [projectPath: string]: string } = {};

    const projectPath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

    if (projectPath) {
        if (!tempDirCache[projectPath]) {
            // Create a new temp directory for the project
            tempDirCache[projectPath] = createTempDirectory();
        }
    }

    let disposable = vscode.commands.registerCommand(
        "vite-serve.runWithVite",
        () => {
            if (!projectPath) {
                return vscode.window.showErrorMessage(
                    "No workspace folder found."
                );
            }

            const tempDir = tempDirCache[projectPath];

            runWithVite(tempDir, projectPath);
        }
    );

    context.subscriptions.push(disposable);

    statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    // statusBarItem.text = "$(play-circle) Start Vite Serve";
    statusBarItem.command = "vite-serve.statusBar";

    const statusBarItemDisposable = vscode.commands.registerCommand(
        "vite-serve.statusBar",
        () => {
            if (viteRunnerProcessId) {
                // Kill all the descendent processes of the process with pid, including the process with pid itself
                treeKill(viteRunnerProcessId, (error) => {
                    if (!error) {
                        vscode.window.showInformationMessage(
                            "Vite Serve: Server stopped successfully."
                        );
                        statusBarItem.hide();
                        viteRunnerProcessId = null;
                    }
                });
            }
        }
    );

    context.subscriptions.push(statusBarItemDisposable);
}

// This method is called when your extension is deactivated
export function deactivate() {}
