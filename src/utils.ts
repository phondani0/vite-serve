import * as vscode from "vscode";
import { exec } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

export const createTempDirectory = (): string => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vite-serve-"));
    return tempDir;
};

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
        fs.unlinkSync(tempSrcDir);
    }

    // Symlink the src directory (you can also copy it if preferred)
    fs.symlinkSync(srcDir, tempSrcDir, "dir");
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

export function createHtmlEntryFile(tempDir: string): void {
    const htmlEntryFilePath = path.join(tempDir, "index.html");

    const content = `
        <!DOCTYPE html>
		<html lang="en">
		<head>
			<meta charset="UTF-8" />
			<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
			<meta name="viewport" content="width=device-width, initial-scale=1.0" />
			<title>Vite React App</title>
		</head>
		<body>
			<div id="root"></div>
			<script type="module" src="/src/index.jsx"></script>
		</body>
		</html>
    `;
    fs.writeFileSync(htmlEntryFilePath, content, "utf8");
}

// Function to read and parse a JSON file
const readJsonFile = (filePath: string) => {
    const content = fs.readFileSync(filePath, "utf8");
    return JSON.parse(content);
};

/**
 * @param projectPath
 * @param tempDir
 *
 * @description Combines the package.json files from the project and temp directories into a single file in the temp directory folder.
 */
export const combinePackageJson = (
    projectPath: string,
    tempDir: string
): void => {
    const tempPackageJsonPath = path.join(tempDir, "package.json");
    const tempPackageJson = readJsonFile(tempPackageJsonPath);

    const projectPackageJsonPath = path.join(projectPath, "package.json");
    const projectPackageJson = readJsonFile(projectPackageJsonPath);

    const combinedPackageJson = {
        ...projectPackageJson,
        dependencies: {
            ...projectPackageJson.dependencies,
            ...tempPackageJson.dependencies,
        },
        devDependencies: {
            ...projectPackageJson.devDependencies,
            ...tempPackageJson.devDependencies,
        },
    };

    // delete existing package.json from temp directory
    fs.unlinkSync(tempPackageJsonPath);

    fs.writeFileSync(
        tempPackageJsonPath,
        JSON.stringify(combinedPackageJson, null, 2),
        "utf8"
    );

    console.log("Combined package.json file created successfully.");
};
