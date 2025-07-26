const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

// Multiple video directories configuration
// Add or modify these paths as needed
const VIDEO_DIRECTORIES = [
  {
    name: 'Main Videos',
    path: '/home/podlomar/Videos',
    description: 'Primary video collection'
  },
  {
    name: 'External Movies',
    path: '/media/podlomar/Data/video',
    description: 'Movie collection (external drive)'
  },
];

// Serve static files from public directory
app.use(express.static('public'));

// Supported video formats
const VIDEO_EXTENSIONS = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v'];

// Check if a directory exists and is accessible
function checkDirectoryStatus(dirPath) {
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

// Recursively scan directory for videos
function scanDirectoryForVideos(dirPath, basePath = '', directoryName = 'Root') {
  const videos = [];

  try {
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const relativePath = path.join(basePath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // Recursively scan subdirectories
        const subVideos = scanDirectoryForVideos(fullPath, relativePath, directoryName);
        videos.push(...subVideos);
      } else if (stat.isFile()) {
        const ext = path.extname(item).toLowerCase();
        if (VIDEO_EXTENSIONS.includes(ext)) {
          videos.push({
            name: item,
            displayName: path.parse(item).name,
            path: `/video/${encodeURIComponent(`${directoryName}/${relativePath}`)}`,
            relativePath: relativePath,
            folder: basePath || directoryName,
            directory: directoryName,
            size: stat.size,
            modified: stat.mtime
          });
        }
      }
    }
  } catch (error) {
    console.error(`Error scanning directory ${dirPath}:`, error);
  }

  return videos;
}

// Get list of videos from all configured directories
app.get('/api/videos', (req, res) => {
  try {
    const allVideos = [];
    const directoryStatuses = [];
    const videosByFolder = {};

    // Scan each configured directory
    for (const videoDir of VIDEO_DIRECTORIES) {
      const status = checkDirectoryStatus(videoDir.path);

      const dirInfo = {
        name: videoDir.name,
        path: videoDir.path,
        description: videoDir.description,
        status: status.status,
        error: status.error,
        videoCount: 0
      };

      if (status.status === 'accessible') {
        try {
          const videos = scanDirectoryForVideos(videoDir.path, '', videoDir.name);
          allVideos.push(...videos);
          dirInfo.videoCount = videos.length;

          // Group videos by folder within this directory
          videos.forEach(video => {
            const folderKey = `${video.directory}/${video.folder}`;
            if (!videosByFolder[folderKey]) {
              videosByFolder[folderKey] = [];
            }
            videosByFolder[folderKey].push(video);
          });
        } catch (error) {
          console.error(`Error scanning ${videoDir.name} (${videoDir.path}):`, error);
          dirInfo.status = 'scan_error';
          dirInfo.error = `Scan failed: ${error.message}`;
        }
      }

      directoryStatuses.push(dirInfo);
    }

    res.json({
      videos: allVideos,
      videosByFolder: videosByFolder,
      totalCount: allVideos.length,
      directories: directoryStatuses
    });
  } catch (error) {
    console.error('Error reading video directories:', error);
    res.status(500).json({ error: 'Failed to read video directories' });
  }
});

// Stream video files
app.get('/video/:directory/:filename(*)', (req, res) => {
  const directory = decodeURIComponent(req.params.directory);
  const filename = decodeURIComponent(req.params.filename);

  // Find the directory configuration
  const videoDir = VIDEO_DIRECTORIES.find(dir => dir.name === directory);
  if (!videoDir) {
    return res.status(404).json({ error: 'Video directory not found' });
  }

  const videoPath = path.join(videoDir.path, filename);

  // Security check - ensure the file is within the configured directory
  if (!videoPath.startsWith(videoDir.path)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Check if file exists
  if (!fs.existsSync(videoPath)) {
    return res.status(404).json({ error: 'Video not found' });
  }

  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;

  // Get the correct MIME type based on file extension
  const ext = path.extname(filename).toLowerCase();
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

// Serve the main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

  console.log(`Server accessible on local network at http://[your-ip]:${PORT}`);

  // Try to get local IP
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`Try: http://${net.address}:${PORT}`);
      }
    }
  }
});
