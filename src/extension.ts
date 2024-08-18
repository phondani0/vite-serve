import { exec } from "child_process";
import * as vscode from "vscode";
import {
    combineDependencies,
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

const runWithVite = async (tempDir: string, projectPath: string) => {
    try {
        vscode.window.showInformationMessage("Preparing Vite environment...");

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

                vscode.window.showInformationMessage(
                    "React app is running with Vite!"
                );
            }
        );
    } catch (error) {
        vscode.window.showErrorMessage(
            "Failed to run the React app with Vite."
        );
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
}

// This method is called when your extension is deactivated
export function deactivate() {}
