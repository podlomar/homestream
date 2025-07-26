const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3001;

// Videos directory path - adjust this to your actual path
const VIDEOS_DIR = '/home/podlomar/Videos';

// Serve static files from public directory
app.use(express.static('public'));

// Supported video formats
const VIDEO_EXTENSIONS = ['.mp4', '.avi', '.mkv', '.mov', '.wmv', '.flv', '.webm', '.m4v'];

// Recursively scan directory for videos
function scanDirectoryForVideos(dirPath, basePath = '') {
  const videos = [];

  try {
    const items = fs.readdirSync(dirPath);

    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const relativePath = path.join(basePath, item);
      const stat = fs.statSync(fullPath);

      if (stat.isDirectory()) {
        // Recursively scan subdirectories
        const subVideos = scanDirectoryForVideos(fullPath, relativePath);
        videos.push(...subVideos);
      } else if (stat.isFile()) {
        const ext = path.extname(item).toLowerCase();
        if (VIDEO_EXTENSIONS.includes(ext)) {
          videos.push({
            name: item,
            displayName: path.parse(item).name,
            path: `/video/${encodeURIComponent(relativePath)}`,
            relativePath: relativePath,
            folder: basePath || 'Root',
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

// Get list of videos
app.get('/api/videos', (req, res) => {
  try {
    if (!fs.existsSync(VIDEOS_DIR)) {
      return res.status(404).json({ error: 'Videos directory not found' });
    }

    const videos = scanDirectoryForVideos(VIDEOS_DIR);

    // Group videos by folder
    const videosByFolder = videos.reduce((acc, video) => {
      const folder = video.folder;
      if (!acc[folder]) {
        acc[folder] = [];
      }
      acc[folder].push(video);
      return acc;
    }, {});

    res.json({
      videos: videos,
      videosByFolder: videosByFolder,
      totalCount: videos.length
    });
  } catch (error) {
    console.error('Error reading videos directory:', error);
    res.status(500).json({ error: 'Failed to read videos directory' });
  }
});

// Stream video files
app.get('/video/:filename(*)', (req, res) => {
  const filename = decodeURIComponent(req.params.filename);
  const videoPath = path.join(VIDEOS_DIR, filename);

  // Security check - ensure the file is within the videos directory
  if (!videoPath.startsWith(VIDEOS_DIR)) {
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
  console.log(`Videos directory: ${VIDEOS_DIR}`);
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
