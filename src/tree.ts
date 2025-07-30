import fs from 'node:fs';
import path from 'node:path';

interface BaseTreeItem {
  fileName: string;
  displayName: string;
  systemPath: string;
  contentPath: string;
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
}

export type TreeItem = Directory | VideoFile;

const videoExtensions = [
  '.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v'
];

export interface TopLevelDirectory {
  displayName: string;
  systemPath: string;
  mountPoint: string;
  description: string;
}

const buildDirectoryTree = (
  dirPath: string,
  basePath: string,
  displayName: string | null,
  maxDepth: number = 10,
  currentDepth: number = 0
): Directory | null => {
  if (currentDepth >= maxDepth) {
    return null;
  }

  try {
    const items = fs.readdirSync(dirPath);
    const fileName = path.basename(dirPath);
    const directory: Directory = {
      type: 'directory',
      fileName,
      displayName: displayName ?? fileName,
      systemPath: dirPath,
      contentPath: basePath,
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
            fullPath, relativePath, null, maxDepth, currentDepth + 1
          );
          if (subDirectory !== null) {
            directory.children.push(subDirectory);
            directory.videoCount += subDirectory.videoCount;
          }
        } else if (stat.isFile()) {
          const ext = path.extname(item).toLowerCase();
          if (videoExtensions.includes(ext)) {
            directory.children.push({
              fileName: item,
              displayName: path.parse(item).name,
              systemPath: fullPath,
              contentPath: relativePath,
              type: 'file',
              size: stat.size,
              modified: stat.mtime,
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
      return a.fileName.localeCompare(b.fileName);
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
    fileName: 'Root',
    displayName: 'Root',
    systemPath: '/',
    contentPath: '/',
    videoCount: 0,
    children: [] as TreeItem[],
  };

  for (const videoDir of topDirectories) {
    try {
      const tree = buildDirectoryTree(videoDir.systemPath, `/${videoDir.mountPoint}`, videoDir.displayName, maxDepth);
      if (tree !== null) {
        root.children.push(tree);
        root.videoCount += tree.videoCount;
      }
    } catch (error) {
      console.error(`Error building tree for ${videoDir.displayName} (${videoDir.systemPath}):`, error);
    }
  }

  return root;
};

export const findTreeItemByPath = (tree: TreeItem, path: string): TreeItem | null => {
  if (tree.contentPath === path) {
    return tree;
  }

  if (tree.type !== 'directory') {
    return null;
  }

  for (const child of tree.children) {
    if (path.startsWith(child.contentPath)) {
      return findTreeItemByPath(child, path);
    }
  }

  return null;
};
