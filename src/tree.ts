import fs from 'node:fs';
import path from 'node:path';

interface BaseTreeItem {
  name: string;
  displayName: string;
  path: string;
  relativePath: string;
}

export interface Directory extends BaseTreeItem {
  type: 'directory';
  children: TreeItem[];
  videoCount: number;
}

export interface VideoFile extends BaseTreeItem {
  type: 'file';
  size: number;
  modified: Date;
  directory: string;
}

export type TreeItem = Directory | VideoFile;

const videoExtensions = [
  '.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v'
];

export interface TopLevelDirectory {
  name: string;
  path: string;
  mount: string;
  description: string;
}

const buildDirectoryTree = (
  dirPath: string,
  basePath: string = '/',
  directoryName: string = 'Root',
  maxDepth: number = 10,
  currentDepth: number = 0
): Directory | null => {
  if (currentDepth >= maxDepth) {
    return null;
  }

  try {
    const items = fs.readdirSync(dirPath);
    const directory: Directory = {
      type: 'directory',
      name: path.basename(dirPath) || directoryName,
      displayName: directoryName,
      path: dirPath,
      relativePath: basePath,
      children: [],
      videoCount: 0,
    };

    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const relativePath = path.join(basePath, item);

      try {
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          const subDirectory = buildDirectoryTree(
            fullPath, relativePath, directoryName, maxDepth, currentDepth + 1
          );
          if (subDirectory !== null) {
            directory.children.push(subDirectory);
            directory.videoCount += subDirectory.videoCount;
          }
        } else if (stat.isFile()) {
          const ext = path.extname(item).toLowerCase();
          if (videoExtensions.includes(ext)) {
            directory.children.push({
              name: item,
              displayName: path.parse(item).name,
              path: fullPath,
              relativePath,
              type: 'file',
              size: stat.size,
              modified: stat.mtime,
              directory: directoryName
            });
            directory.videoCount += 1;
          }
        }
      } catch (itemError) {
        console.error(`Error processing item ${fullPath}:`, itemError);
      }
    }

    // Sort children: directories first, then files, both alphabetically
    directory.children.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return directory;
  } catch (error) {
    console.error(`Error building directory tree for ${dirPath}:`, error);
    return null;
  }
}

export const buildRootTree = (topDirectories: TopLevelDirectory[], maxDepth: number = 10): Directory => {
  const root: Directory = {
    type: 'directory',
    name: 'Root',
    displayName: 'Root',
    path: '/',
    relativePath: '/',
    videoCount: 0,
    children: [] as TreeItem[],
  };

  for (const videoDir of topDirectories) {
    try {
      const tree = buildDirectoryTree(videoDir.path, `/${videoDir.mount}`, videoDir.name, maxDepth);
      if (tree !== null) {
        root.children.push(tree);
        root.videoCount += tree.videoCount;
      }
    } catch (error) {
      console.error(`Error building tree for ${videoDir.name} (${videoDir.path}):`, error);
    }
  }

  return root;
};

export const findTreeItemByPath = (tree: TreeItem, path: string): TreeItem | null => {
  if (tree.relativePath === path) {
    return tree;
  }

  if (tree.type !== 'directory') {
    return null;
  }

  for (const child of tree.children) {
    if (path.startsWith(child.relativePath)) {
      return findTreeItemByPath(child, path);
    }
  }

  return null;
};
