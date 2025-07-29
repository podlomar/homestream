import express from 'express';
import expressNunjucks from 'express-nunjucks';
import fs from 'node:fs';
import path from 'node:path';

const app = express();
const PORT = 3001;

app.set('views', 'templates');
app.set('view engine', 'njk');
app.use(express.static('public'));

const isDev = app.get('env') === 'development';
expressNunjucks(app, {
  watch: isDev,
  noCache: isDev,
});

const VIDEO_DIRECTORIES = [
  {
    name: 'Computer',
    path: '/home/podlomar/Videos',
    mount: 'computer',
    description: 'Computer video collection'
  },
  {
    name: 'External Hard Drive',
    path: '/media/podlomar/Data/video',
    mount: 'external',
    description: 'Movie collection (external drive)'
  },
  {
    name: 'SanDisk Archive',
    path: '/media/podlomar/SanDisk',
    mount: 'sandisk',
    description: 'Flash drive archive'
  }
];

const VIDEO_EXTENSIONS = [
  '.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v'
];

const checkDirectoryStatus = (dirPath) => {
  try {
    if (!fs.existsSync(dirPath)) {
      return { status: 'not_found', error: 'Directory does not exist' };
    }

    const stat = fs.statSync(dirPath);
    if (!stat.isDirectory()) {
      return { status: 'not_directory', error: 'Path is not a directory' };
    }

    // Test read access
    fs.readdirSync(dirPath);
    return { status: 'accessible' };
  } catch (error) {
    if (error.code === 'EACCES') {
      return { status: 'no_permission', error: 'Permission denied' };
    } else if (error.code === 'ENOTDIR') {
      return { status: 'not_directory', error: 'Path is not a directory' };
    } else if (error.code === 'EIO') {
      return { status: 'io_error', error: 'I/O error (possibly unmounted)' };
    } else if (error.code === 'ENOENT') {
      return { status: 'not_found', error: 'Directory not found' };
    }
    return { status: 'error', error: error.message };
  }
}

const encodePath = (dirPath) => {
  return encodeURIComponent(dirPath).replace(/%2F/g, '/');
}

const buildDirectoryTree = (dirPath, basePath = '/', directoryName = 'Root', maxDepth = 10, currentDepth = 0) => {
  if (currentDepth >= maxDepth) {
    return null;
  }

  try {
    const items = fs.readdirSync(dirPath);
    const tree = {
      name: path.basename(dirPath) || directoryName,
      path: dirPath,
      relativePath: basePath,
      type: 'directory',
      children: [],
      videoCount: 0,
      directoryCount: 0
    };

    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const relativePath = path.join(basePath, item);

      try {
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          const subTree = buildDirectoryTree(fullPath, relativePath, directoryName, maxDepth, currentDepth + 1);
          if (subTree) {
            tree.children.push(subTree);
            tree.directoryCount += 1 + subTree.directoryCount;
            tree.videoCount += subTree.videoCount;
          }
        } else if (stat.isFile()) {
          const ext = path.extname(item).toLowerCase();
          if (VIDEO_EXTENSIONS.includes(ext)) {
            tree.children.push({
              name: item,
              displayName: path.parse(item).name,
              path: fullPath,
              relativePath,
              type: 'file',
              size: stat.size,
              modified: stat.mtime,
              directory: directoryName
            });
            tree.videoCount += 1;
          }
        }
      } catch (itemError) {
        console.error(`Error processing item ${fullPath}:`, itemError);
      }
    }

    // Sort children: directories first, then files, both alphabetically
    tree.children.sort((a, b) => {
      if (a.type !== b.type) {
        return a.type === 'directory' ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    return tree;
  } catch (error) {
    console.error(`Error building directory tree for ${dirPath}:`, error);
    return null;
  }
}

const buildDirectoryTreeForAll = (maxDepth = 10) => {
  const directoryTrees = [];

  for (const videoDir of VIDEO_DIRECTORIES) {
    try {
      const tree = buildDirectoryTree(videoDir.path, `/${videoDir.mount}`, videoDir.name, maxDepth);
      directoryTrees.push(tree);
    } catch (error) {
      console.error(`Error building tree for ${videoDir.name} (${videoDir.path}):`, error);
      dirInfo.status = 'tree_error';
      dirInfo.error = `Tree build failed: ${error.message}`;
    }
  }

  return directoryTrees;
};

const findDirectoryByPath = (tree, path) => {
  if (tree.relativePath === path) {
    return tree;
  }

  for (const child of tree.children || []) {
    if (path.startsWith(child.relativePath)) {
      return findDirectoryByPath(child, path);
    }
  }

  return null;
};

const root = {
  name: 'Root',
  path: '/',
  relativePath: '/',
  type: 'directory',
  children: buildDirectoryTreeForAll(10)
};

app.get('/api/browse/', (req, res) => {
  const data = {
    ...root,
    children: root.children.map(child => ({
      ...child,
      children: undefined,
      url: `/api/browse${encodePath(child.relativePath)}`
    }))
  };

  res.json(data);
});

app.get('/api/trees', (req, res) => {
  res.json(trees);
});

// Browse a specific folder within a directory (non-recursive, immediate children only)
app.get('/api/browse/:path(*)', (req, res) => {
  const directoryPath = decodeURIComponent(req.params.path);
  const dir = findDirectoryByPath(root, `/${directoryPath}`);
  if (!dir) {
    return res.status(404).json({ error: 'Directory not found' });
  }

  const data = {
    ...dir,
    children: dir.children.map(child => ({
      ...child,
      children: undefined,
      url: `/api/browse${encodePath(child.relativePath)}`
    }))
  };

  res.json(data);
});

app.get('/', (req, res) => {
  const directory = {
    ...root,
    children: root.children.map(child => ({
      ...child,
      children: undefined,
      url: child.type === 'directory'
        ? `/browse${child.relativePath}`
        : `/video${child.relativePath}`
    }))
  };

  res.render('index.njk', {
    title: 'Video Streaming Server',
    directory,
  });
});

app.get('/browse/:path(*)', (req, res) => {
  const directoryPath = decodeURIComponent(req.params.path);
  const dir = findDirectoryByPath(root, `/${directoryPath}`);
  if (!dir) {
    return res.status(404).json({ error: 'Directory not found' });
  }


  const directory = {
    ...dir,
    children: dir.children.map(child => ({
      ...child,
      children: undefined,
      url: child.type === 'directory'
        ? `/browse${child.relativePath}`
        : `/video${child.relativePath}`
    }))
  };

  res.render('index.njk', {
    title: `Browsing ${directoryPath}`,
    directory,
  });
});

app.get('/video/:path(*)', (req, res) => {
  const directoryPath = decodeURIComponent(req.params.path);
  const dir = findDirectoryByPath(root, `/${directoryPath}`);
  if (!dir) {
    return res.status(404).json({ error: 'Directory not found' });
  }

  res.render('video.njk', {
    title: `Browsing ${directoryPath}`,
    videoSrc: `/stream/${directoryPath}`,
  });
});

app.get('/stream/:path(*)', (req, res) => {
  const videoDir = findDirectoryByPath(root, `/${req.params.path}`);
  if (!videoDir) {
    return res.status(404).json({ error: 'Video directory not found' });
  }

  const videoPath = decodeURIComponent(videoDir.path);

  console.log(`Streaming video from: ${videoPath}`);

  // Check if file exists
  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ error: 'Video not found' });
  }

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  // Get the correct MIME type based on file extension
  const ext = path.extname(videoPath).toLowerCase();
  const mimeTypes = {
    '.mp4': 'video/mp4',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.mov': 'video/quicktime',
    '.wmv': 'video/x-ms-wmv',
    '.flv': 'video/x-flv',
    '.webm': 'video/webm',
    '.m4v': 'video/mp4'
  };
  const contentType = mimeTypes[ext] || 'video/mp4';

  if (range) {
    // Support for video seeking with range requests
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(videoPath, { start, end });
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': contentType,
    };
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    // Regular video streaming
    const head = {
      'Content-Length': fileSize,
      'Content-Type': contentType,
    };
    res.writeHead(200, head);
    fs.createReadStream(videoPath).pipe(res);
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Video streaming server running on http://localhost:${PORT}`);
  console.log(`Configured video directories:`);

  VIDEO_DIRECTORIES.forEach(dir => {
    const status = checkDirectoryStatus(dir.path);
    const statusEmoji = status.status === 'accessible' ? '✅' : '❌';
    console.log(`  ${statusEmoji} ${dir.name}: ${dir.path} (${dir.description})`);
    if (status.status !== 'accessible') {
      console.log(`    Error: ${status.error}`);
    }
  });

  console.log(`Server listening on port ${PORT}`);
});
