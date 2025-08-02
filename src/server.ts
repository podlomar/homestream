import fs from 'node:fs';
import path from 'node:path';
import express, { Request, Response } from 'express';
import expressNunjucks from 'express-nunjucks';
import { VideoLibrary, type TopLevelDirectory } from './tree.js';

const app = express();
const PORT = 3001;

app.set('views', 'templates');
app.set('view engine', 'njk');
app.use(express.static('public'));
app.use(express.json());

const isDev = app.get('env') === 'development';

// @ts-expect-error
expressNunjucks(app, {
  watch: isDev,
  noCache: isDev,
});

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
};

const videoDirectories: TopLevelDirectory[] = [
  {
    displayName: 'Computer',
    systemPath: '/home/podlomar/Videos',
    mountPoint: 'computer',
    description: 'Computer video collection',
  },
  {
    displayName: 'External Hard Drive',
    systemPath: '/media/podlomar/Data/video',
    mountPoint: 'external',
    description: 'Movie collection (external drive)',
  },
  {
    displayName: 'SanDisk Archive',
    systemPath: '/media/podlomar/SanDisk',
    mountPoint: 'sandisk',
    description: 'Flash drive archive',
  },
];

const videoLibrary = await VideoLibrary.load(videoDirectories);

app.post('/api/progress', async (req: Request, res: Response) => {
  try {
    const { videoPath, position } = req.body;

    if (typeof videoPath !== 'string' || typeof position !== 'number') {
      return res.status(400).json({ error: 'Invalid videoPath or position' });
    }

    videoLibrary.saveVideoProgress(`/${videoPath}`, position);
    return res.json({ success: true });
  } catch (error) {
    console.error('Error saving progress:', error);
    return res.status(500).json({ error: 'Failed to save progress' });
  }
});

app.get('/api/progress/:path(*)', async (req: Request, res: Response) => {
  try {
    const videoPath = req.params['path'] ?? '';
    const position = videoLibrary.getVideoProgress(videoPath);
    return res.json({ videoPath, position });
  } catch (error) {
    console.error('Error getting progress:', error);
    return res.status(500).json({ error: 'Failed to get progress' });
  }
});

app.delete('/api/progress/:path(*)', async (req: Request, res: Response) => {
  try {
    const videoPath = req.params['path'] ?? '';
    videoLibrary.deleteVideoProgress(videoPath);
    return res.json({ success: true });
  } catch (error) {
    console.error('Error removing progress:', error);
    return res.status(500).json({ error: 'Failed to remove progress' });
  }
});

const formatDuration = (seconds: number): string => {
  const wholeSeconds = Math.floor(seconds);
  if (wholeSeconds === 0) return 'No playback';

  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const secs = Math.floor(wholeSeconds % 60);

  const strHours = hours > 0 ? `${hours}h ` : '';
  const strMinutes = minutes > 0 ? `${minutes}m ` : '';
  const strSecs = `${secs}s`;

  return `${strHours}${strMinutes}${strSecs}`;
};

app.get('/', (_req: Request, res: Response): void => {
  const root = videoLibrary.getRoot();
  const directory = {
    ...root,
    children: root.children.map((child) => ({
      ...child,
      children: undefined,
      url:
        child.type === 'directory' ? `/browse${child.contentPath}` : `/video${child.contentPath}`,
      lastPlaybackPosition: formatDuration(videoLibrary.getVideoProgress(child.contentPath)),
    })),
  };

  return res.render('index.njk', {
    title: 'Video Streaming Server',
    directory,
  });
});

app.get('/browse/:path(*)', (req: Request, res: Response): void => {
  const directoryPath = req.params['path'] ?? '';
  const treeItem = videoLibrary.findItemByPath(`/${directoryPath}`);
  if (treeItem === null) {
    return res.status(404).render('error.njk', {
      title: 'Directory Not Found',
      statusCode: 404,
      message: `Directory not found: ${directoryPath}`,
    });
  }

  if (treeItem.type !== 'directory') {
    return res.status(400).render('error.njk', {
      title: 'Invalid Directory',
      statusCode: 400,
      message: `Path is not a directory: ${directoryPath}`,
    });
  }

  const directory = {
    ...treeItem,
    children: treeItem.children.map((child) => ({
      ...child,
      children: undefined,
      url:
        child.type === 'directory' ? `/browse${child.contentPath}` : `/video${child.contentPath}`,
      lastPlaybackPosition: formatDuration(videoLibrary.getVideoProgress(child.contentPath) ?? 0),
    })),
  };

  return res.render('index.njk', {
    title: `Browsing ${directoryPath}`,
    directory,
  });
});

app.get('/video/:path(*)', async (req: Request, res: Response) => {
  const videoPath = req.params['path'] ?? '';
  const videoItem = videoLibrary.findItemByPath(`/${videoPath}`);

  if (videoItem === null || videoItem.type !== 'file') {
    return res.status(404).render('error.njk', {
      title: 'Video Not Found',
      statusCode: 404,
      message: `Video not found: ${videoPath}`,
    });
  }

  return res.render('video.njk', {
    title: `Browsing ${videoPath}`,
    videoSrc: `/stream/${videoPath}`,
    videoPath: videoPath,
    lastPosition: videoItem.lastPlaybackPosition,
  });
});

app.get('/stream/:path(*)', (req: Request, res: Response): void => {
  const videoPath = req.params['path'] ?? '';
  const videoItem = videoLibrary.findItemByPath(`/${videoPath}`);
  if (videoItem === null || videoItem.type !== 'file') {
    return res.status(404).render('error.njk', {
      title: 'Video Not Found',
      statusCode: 404,
      message: `Video not found: ${videoPath}`,
    });
  }

  const systemPath = decodeURIComponent(videoItem.systemPath);
  if (!fs.existsSync(systemPath)) {
    return res.status(404).render('error.njk', {
      title: 'Video Not Found',
      statusCode: 404,
      message: `Video not found: ${videoPath}`,
    });
  }

  const stat = fs.statSync(systemPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  const ext = path.extname(systemPath).toLowerCase();
  const mimeTypes: { [key in string]?: string } = {
    '.mp4': 'video/mp4',
    '.avi': 'video/x-msvideo',
    '.mkv': 'video/x-matroska',
    '.mov': 'video/quicktime',
    '.wmv': 'video/x-ms-wmv',
    '.flv': 'video/x-flv',
    '.webm': 'video/webm',
    '.m4v': 'video/mp4',
  };

  const contentType = mimeTypes[ext] ?? 'video/mp4';

  if (range) {
    // Support for video seeking with range requests
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(systemPath, { start, end });
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
    fs.createReadStream(systemPath).pipe(res);
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Video streaming server running on http://localhost:${PORT}`);
  console.log(`Configured video directories:`);

  videoDirectories.forEach((dir) => {
    const status = checkDirectoryStatus(dir.systemPath);
    const statusEmoji = status.status === 'accessible' ? '✅' : '❌';
    console.log(`  ${statusEmoji} ${dir.displayName}: ${dir.systemPath} (${dir.description})`);
    if (status.status !== 'accessible') {
      console.log(`    Error: ${status.error}`);
    }
  });

  console.log(`Server listening on port ${PORT}`);
});
