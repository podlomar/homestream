import express from 'express';
import expressNunjucks from 'express-nunjucks';
import fs from 'node:fs';
import path from 'node:path';
import { buildRootTree, findTreeItemByPath, TopLevelDirectory } from './tree.js';

const app = express();
const PORT = 3001;

app.set('views', 'templates');
app.set('view engine', 'njk');
app.use(express.static('public'));

const isDev = app.get('env') === 'development';

// @ts-expect-error
expressNunjucks(app, {
  watch: isDev,
  noCache: isDev,
});

const videoDirectories: TopLevelDirectory[] = [
  {
    displayName: 'Computer',
    systemPath: '/home/podlomar/Videos',
    mountPoint: 'computer',
    description: 'Computer video collection'
  },
  {
    displayName: 'External Hard Drive',
    systemPath: '/media/podlomar/Data/video',
    mountPoint: 'external',
    description: 'Movie collection (external drive)'
  },
  {
    displayName: 'SanDisk Archive',
    systemPath: '/media/podlomar/SanDisk',
    mountPoint: 'sandisk',
    description: 'Flash drive archive'
  }
];

interface DirectoryStatus {
  status: 'accessible' | 'not_found' | 'not_directory' | 'no_permission' | 'io_error' | 'error';
  error?: string;
}

const checkDirectoryStatus = (dirPath: string): DirectoryStatus => {
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
  } catch (e) {
    const error = e as NodeJS.ErrnoException;
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

const root = buildRootTree(videoDirectories, 10);

app.get('/', (req, res) => {
  const directory = {
    ...root,
    children: root.children.map(child => ({
      ...child,
      children: undefined,
      url: child.type === 'directory'
        ? `/browse${child.contentPath}`
        : `/video${child.contentPath}`
    }))
  };

  res.render('index.njk', {
    title: 'Video Streaming Server',
    directory,
  });
});

app.get('/browse/:path(*)', (req, res) => {
  const directoryPath = decodeURIComponent(req.params.path);
  const dir = findTreeItemByPath(root, `/${directoryPath}`);
  if (dir === null) {
    return res.status(404).json({ error: 'Directory not found' });
  }

  if (dir.type !== 'directory') {
    return res.status(400).json({ error: 'Path is not a directory' });
  }

  const directory = {
    ...dir,
    children: dir.children.map(child => ({
      ...child,
      children: undefined,
      url: child.type === 'directory'
        ? `/browse${child.contentPath}`
        : `/video${child.contentPath}`
    }))
  };

  res.render('index.njk', {
    title: `Browsing ${directoryPath}`,
    directory,
  });
});

app.get('/video/:path(*)', (req, res) => {
  const directoryPath = decodeURIComponent(req.params.path);
  const videoItem = findTreeItemByPath(root, `/${directoryPath}`);

  if (videoItem === null || videoItem.type !== 'file') {
    return res.status(404).json({ error: 'Video not found' });
  }

  res.render('video.njk', {
    title: `Browsing ${directoryPath}`,
    videoSrc: `/stream/${directoryPath}`,
  });
});

app.get('/stream/:path(*)', (req, res) => {
  const videoFile = findTreeItemByPath(root, `/${req.params.path}`);
  if (videoFile === null || videoFile.type !== 'file') {
    return res.status(404).json({ error: 'Video not found' });
  }

  const videoPath = decodeURIComponent(videoFile.systemPath);
  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ error: 'Video not found' });
  }

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  const ext = path.extname(videoPath).toLowerCase();
  const mimeTypes: { [key in string]?: string } = {
    '.mp4': 'video/mp4',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.mov': 'video/quicktime',
    '.wmv': 'video/x-ms-wmv',
    '.flv': 'video/x-flv',
    '.webm': 'video/webm',
    '.m4v': 'video/mp4'
  };

  const contentType = mimeTypes[ext] ?? 'video/mp4';

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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Video streaming server running on http://localhost:${PORT}`);
  console.log(`Configured video directories:`);

  videoDirectories.forEach(dir => {
    const status = checkDirectoryStatus(dir.systemPath);
    const statusEmoji = status.status === 'accessible' ? '✅' : '❌';
    console.log(`  ${statusEmoji} ${dir.displayName}: ${dir.systemPath} (${dir.description})`);
    if (status.status !== 'accessible') {
      console.log(`    Error: ${status.error}`);
    }
  });

  console.log(`Server listening on port ${PORT}`);
});
