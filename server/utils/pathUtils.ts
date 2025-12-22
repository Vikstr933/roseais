import path from 'path';
import { promises as fs } from 'fs';

// Use environment variable for workspaces path (for Docker volume mounting)
// Falls back to local workspaces directory for development
export const WORKSPACES_DIR = process.env.WORKSPACES_PATH || path.join(process.cwd(), 'workspaces');

export function getWorkspacePath(workspaceId: string) {
  return path.join(WORKSPACES_DIR, workspaceId);
}

export function getRelativePath(workspaceId: string, filePath: string) {
  return path.relative(getWorkspacePath(workspaceId), filePath);
}

export class PathUtils {
  private workspacePath: string;
  private features: any;

  constructor(workspacePath: string, features: any) {
    this.workspacePath = workspacePath;
    this.features = features;
  }

  resolvePath(relativePath: string) {
    return path.join(this.workspacePath, relativePath);
  }

  async createDirectory(dirPath: string) {
    await fs.mkdir(dirPath, { recursive: true });
  }

  async writeFile(filePath: string, content: string) {
    await fs.writeFile(filePath, content);
  }

  async getGeneratedFiles() {
    const files: Array<{ path: string; content: string }> = [];

    const walkDirectory = async (dir: string) => {
      const items = await fs.readdir(dir);

      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {
          await walkDirectory(fullPath);
        } else if (stat.isFile()) {
          const relativePath = path.relative(this.workspacePath, fullPath);
          const content = await fs.readFile(fullPath, 'utf-8');
          files.push({
            path: relativePath,
            content,
          });
        }
      }
    };

    await walkDirectory(this.workspacePath);
    return files;
  }
}
