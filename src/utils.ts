import * as vscode from "vscode";
import { exec } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export function createTempDirectory(): string {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vite-extension-"));
    return tempDir;
}

export function installViteInTempDir(tempDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const installCommand =
            "npm install vite @vitejs/plugin-react --save-dev";
        exec(installCommand, { cwd: tempDir }, (error, stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage(
                    `Failed to install Vite: ${stderr}`
                );
                reject(error);
                return;
            }

            resolve();
        });
    });
}

export function symlinkOrCopyProjectFiles(
    projectPath: string,
    tempDir: string
): void {
    const srcDir = path.join(projectPath, "src");
    const tempSrcDir = path.join(tempDir, "src");

    if (fs.existsSync(tempSrcDir)) {
        fs.rmdirSync(tempSrcDir, { recursive: true });
    }

    // Symlink the src directory (you can also copy it if preferred)
    fs.symlinkSync(srcDir, tempSrcDir, "dir");

    // Copy index.html if needed (for Vite)
    const indexPath = path.join(projectPath, "index.html");
    if (fs.existsSync(indexPath)) {
        fs.copyFileSync(indexPath, path.join(tempDir, "index.html"));
    }
}

export function createViteConfig(tempDir: string, projectRoot: string): void {
    const viteConfigPath = path.join(tempDir, "vite.config.js");
    const configContent = `
        import { defineConfig } from 'vite';
        import react from '@vitejs/plugin-react';

        export default defineConfig({
            plugins: [react()],
            root: '.',
            build: {
                outDir: 'dist',
            },
            server: {
				port: 3500,
                open: true, // Open the browser automatically
				fs: {
					allow: ['${projectRoot}/src']
				}
            },
        });
    `;
    fs.writeFileSync(viteConfigPath, configContent, "utf8");
}
