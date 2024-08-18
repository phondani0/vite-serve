import * as vscode from "vscode";
import { exec } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as dotenv from "dotenv";

export const createTempDirectory = (): string => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "vite-serve-"));
    return tempDir;
};

export function installViteInTempDir(tempDir: string): Promise<void> {
    return new Promise((resolve, reject) => {
        vscode.window.showInformationMessage("Preparing Vite environment...");

        const installCommand =
            "npm install vite @vitejs/plugin-react vite-plugin-node-polyfills --save-dev";
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
    const dirs = ["public", "src"];
    const files = ["tsconfig.json"];

    dirs.forEach((dir) => {
        const srcDir = path.join(projectPath, dir);
        const tempSrcDir = path.join(tempDir, dir);

        if (fs.existsSync(tempSrcDir)) {
            // Remove the tempSrcDir directory, regardless of whether it's a symbolic link or a directory.
            fs.rmSync(tempSrcDir, { recursive: true, force: true });
        }

        // Symlink the src directory (you can also copy it if preferred)
        fs.symlinkSync(srcDir, tempSrcDir, "dir");
    });

    files.forEach((file) => {
        const filePath = path.join(projectPath, file);

        if (fs.existsSync(filePath)) {
            fs.copyFileSync(filePath, path.join(tempDir, file));
        }
    });

    // @TODO: Add a condtion where if package.json is changed then don't us the existing node_modules.
    if (
        fs.existsSync(path.join(projectPath, "node_modules")) &&
        !fs.existsSync(path.join(tempDir, "node_modules"))
    ) {
        fs.cpSync(
            path.join(projectPath, "node_modules"),
            path.join(tempDir, "node_modules"),
            { recursive: true }
        );
    }
}

const getEnvironmentVariables = (
    projectRoot: string
): { [name: string]: string } | undefined => {
    const envPath = path.join(projectRoot, ".env");

    // Check if .env file exists
    if (fs.existsSync(envPath)) {
        // Load environment variables from .env file without modifying process.env
        const envConfig = dotenv.parse(fs.readFileSync(envPath));
        return envConfig;
    }
};

export function createViteConfig(tempDir: string, projectRoot: string): void {
    const envVariables = getEnvironmentVariables(projectRoot) || {};

    const viteConfigPath = path.join(tempDir, "vite.config.js");
    const configContent = `
        import { defineConfig } from 'vite';
        import react from '@vitejs/plugin-react';
		import { nodePolyfills } from 'vite-plugin-node-polyfills';

        export default defineConfig({
            root: '.',
            plugins: [
				react(),
				nodePolyfills()
			],
			define: {
				process: {
					env: ${JSON.stringify(envVariables)},
				},
			},
            build: {
                outDir: 'dist',
            },
			esbuild: {
				loader: "tsx",
				include: new RegExp("src\/.*\.(jsx|tsx|js|ts)$"),
				exclude: [],
			},
			optimizeDeps: {
				esbuildOptions: {
					loader: {
						".js": "jsx",
					},
				},
			},
            server: {
				port: 3500,
                open: true, // Open the browser automatically
            },
			resolve: {
				preserveSymlinks: true,
			}
        });
    `;
    fs.writeFileSync(viteConfigPath, configContent, "utf8");
}

export function createHtmlEntryFile(
    tempDir: string,
    projectPath: string
): void {
    // Move it out.
    const srcFiles = fs.readdirSync(path.join(projectPath, "src"));
    const indexFile = srcFiles.find((file) =>
        file.match(/^index\.(ts|tsx|js|jsx)$/)
    );

    if (!indexFile) {
        throw new Error(
            "Missing '/src/index' file. Please create an 'index' file with a '.ts', '.tsx', '.js', or '.jsx' extension at the '/src' directory."
        );
    }

    const indexFileExt = path.extname(indexFile);
    const htmlEntryFilePath = path.join(tempDir, "index.html");

    const entryFileScriptTag = `<script type="module" src="/src/index${indexFileExt}"></script>`;

    const existingIndexHtmlPath = path.join(
        projectPath,
        "public",
        "index.html"
    );

    if (fs.existsSync(existingIndexHtmlPath)) {
        const htmlContent = fs.readFileSync(existingIndexHtmlPath, "utf8");

        // Append the entry file script tag to the end of the body and replace the %PUBLIC_URL% placeholder with the base URL/path
        const updatedHtmlContent = htmlContent
            .replace("</body>", `${entryFileScriptTag}</body>`)
            .replaceAll("%PUBLIC_URL%", "${import.meta.env.BASE_URL}/public");

        fs.writeFileSync(htmlEntryFilePath, updatedHtmlContent, "utf8");
    } else {
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
				${entryFileScriptTag}
			</body>
			</html>
		`;

        fs.writeFileSync(htmlEntryFilePath, content, "utf8");
    }
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
 * @description Merges user project dependencies with required Vite dependencies and updates tempDir package.json.
 */
export const combineDependencies = (
    projectPath: string,
    tempDir: string
): void => {
    const tempPackageJsonPath = path.join(tempDir, "package.json");

    const projectPackageJsonPath = path.join(projectPath, "package.json");
    const projectPackageJson = readJsonFile(projectPackageJsonPath);

    const combinedPackageJson = {
        ...projectPackageJson,
        dependencies: {
            ...projectPackageJson.dependencies,
        },
        devDependencies: {
            ...projectPackageJson.devDependencies,
            vite: "latest",
            "@vitejs/plugin-react": "latest",
            "vite-plugin-node-polyfills": "latest",
        },
    };

    fs.writeFileSync(
        tempPackageJsonPath,
        JSON.stringify(combinedPackageJson, null, 2),
        "utf8"
    );
};
