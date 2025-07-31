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

const videoExtensions = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v'];

export interface TopLevelDirectory {
  displayName: string;
  systemPath: string;
  mountPoint: string;
  description: string;
}

const sortTreeItems = (items: TreeItem[]): void => {
  items.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1;
    }
    return a.fileName.localeCompare(b.fileName);
  });
};

function createTreeItem(
  item: string,
  parent: Directory,
  maxDepth: number,
  currentDepth: number = 0
): TreeItem | null {
  const systemPath = path.join(parent.systemPath, item);
  const contentPath = path.join(parent.contentPath, item);

  try {
    const stat = fs.statSync(systemPath);
    if (stat.isDirectory()) {
      const subDirectory = buildDirectoryTree(
        systemPath,
        contentPath,
        null,
        maxDepth,
        currentDepth + 1
      );
      if (subDirectory !== null) {
        return subDirectory;
      }
    } else if (stat.isFile()) {
      const ext = path.extname(item).toLowerCase();
      if (videoExtensions.includes(ext)) {
        return {
          type: 'file',
          fileName: item,
          displayName: path.parse(item).name,
          systemPath,
          contentPath,
          size: stat.size,
          modified: stat.mtime,
        };
      }
    }
  } catch (itemError) {
    console.error(`Error processing item ${systemPath}:`, itemError);
  }

  return null;
}

function buildDirectoryTree(
  dirPath: string,
  basePath: string,
  displayName: string | null,
  maxDepth: number = 10,
  currentDepth: number = 0
): Directory | null {
  if (currentDepth >= maxDepth) {
    return null;
  }

  try {
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

    const items = fs.readdirSync(directory.systemPath);
    for (const item of items) {
      const treeItem = createTreeItem(item, directory, maxDepth, currentDepth);

      if (treeItem === null) {
        continue;
      }

      directory.children.push(treeItem);
      if (treeItem.type === 'file') {
        directory.videoCount++;
      } else if (treeItem.type === 'directory') {
        directory.videoCount += treeItem.videoCount;
      }
    }

    sortTreeItems(directory.children);

    return directory;
  } catch (error) {
    console.error(`Error building directory tree for ${dirPath}:`, error);
    return null;
  }
}

export const buildRootTree = (
  topDirectories: TopLevelDirectory[],
  maxDepth: number = 10
): Directory => {
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
      const tree = buildDirectoryTree(
        videoDir.systemPath,
        `/${videoDir.mountPoint}`,
        videoDir.displayName,
        maxDepth
      );
      if (tree !== null) {
        root.children.push(tree);
        root.videoCount += tree.videoCount;
      }
    } catch (error) {
      console.error(
        `Error building tree for ${videoDir.displayName} (${videoDir.systemPath}):`,
        error
      );
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
