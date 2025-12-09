import fs from 'fs';
import path from 'path';
import { execa } from 'execa';
import { WORKSPACES_DIR, getWorkspacePath } from './pathUtils';

export async function saveFilesToWorkspace(
  workspaceId: string,
  files: Array<{ path: string; content: string }>
) {
  const workspacePath = getWorkspacePath(workspaceId);

  // Create workspace directory
  if (!fs.existsSync(workspacePath)) {
    fs.mkdirSync(workspacePath, { recursive: true });
  }

  // Save each file
  for (const file of files) {
    const filePath = path.join(workspacePath, file.path);
    const dirPath = path.dirname(filePath);

    // Create directory if it doesn't exist
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    // Write file content
    fs.writeFileSync(filePath, file.content);
  }
}

export async function installWorkspaceDependencies(workspaceId: string) {
  const workspacePath = path.join(WORKSPACES_DIR, workspaceId);

  // Check for package.json
  const packageJsonPath = path.join(workspacePath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    // Install dependencies
    await execa('npm', ['install'], {
      cwd: workspacePath,
      stdio: 'inherit',
    });
  }

  // Ensure tailwind config exists
  const tailwindConfigPath = path.join(workspacePath, 'tailwind.config.js');
  if (!fs.existsSync(tailwindConfigPath)) {
    fs.writeFileSync(
      tailwindConfigPath,
      `
      module.exports = {
        content: [
          './src/**/*.{js,jsx,ts,tsx}',
          './public/index.html'
        ],
        theme: {
          extend: {},
        },
        plugins: [],
      }
    `
    );
  }

  // Ensure postcss config exists
  const postcssConfigPath = path.join(workspacePath, 'postcss.config.js');
  if (!fs.existsSync(postcssConfigPath)) {
    fs.writeFileSync(
      postcssConfigPath,
      `
      module.exports = {
        plugins: {
          tailwindcss: {},
          autoprefixer: {},
        },
      }
    `
    );
  }
}

export function getWorkspaceFiles(workspaceId: string) {
  const workspacePath = path.join(WORKSPACES_DIR, workspaceId);
  const files: Array<{ path: string; content: string }> = [];

  function walkDirectory(dir: string) {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        walkDirectory(fullPath);
      } else if (stat.isFile()) {
        const relativePath = path.relative(workspacePath, fullPath);
        const content = fs.readFileSync(fullPath, 'utf-8');
        files.push({
          path: relativePath,
          content,
        });
      }
    }
  }

  if (fs.existsSync(workspacePath)) {
    walkDirectory(workspacePath);
  }

  return files;
}
