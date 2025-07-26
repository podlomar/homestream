class VideoPlayer {
  constructor() {
    this.videoPlayer = document.getElementById('videoPlayer');
    this.videoList = document.getElementById('videoList');
    this.loadingMessage = document.getElementById('loadingMessage');
    this.errorMessage = document.getElementById('errorMessage');
    this.noVideoMessage = document.getElementById('noVideoMessage');
    this.refreshBtn = document.getElementById('refreshBtn');
    this.fullscreenBtn = document.getElementById('fullscreenBtn');

    this.currentVideo = null;
    this.videos = [];

    this.initializeEventListeners();
    this.loadVideos();
  }

  initializeEventListeners() {
    this.refreshBtn.addEventListener('click', () => this.loadVideos());

    this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());

    this.videoPlayer.addEventListener('loadstart', () => {
      this.noVideoMessage.style.display = 'none';
      this.videoPlayer.style.display = 'block';
      this.fullscreenBtn.style.display = 'inline-block';
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (this.videoPlayer.style.display !== 'none') {
        switch (e.code) {
          case 'Space':
            e.preventDefault();
            this.togglePlayPause();
            break;
          case 'KeyF':
            e.preventDefault();
            this.toggleFullscreen();
            break;
          case 'ArrowLeft':
            e.preventDefault();
            this.videoPlayer.currentTime -= 10;
            break;
          case 'ArrowRight':
            e.preventDefault();
            this.videoPlayer.currentTime += 10;
            break;
        }
      }
    });
  }

  async loadVideos() {
    this.showLoading();
    this.hideError();

    try {
      const response = await fetch('/api/videos');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      this.videos = data.videos;
      this.videosByFolder = data.videosByFolder;
      this.renderVideoList(data);
      this.hideLoading();

    } catch (error) {
      console.error('Error loading videos:', error);
      this.hideLoading();
      this.showError('Failed to load videos. Please check if the server is running and the videos directory exists.');
    }
  }

  renderVideoList(data) {
    if (data.totalCount === 0) {
      this.videoList.innerHTML = `
                <div class="no-videos">
                    <div style="font-size: 4em; margin-bottom: 20px;">📁</div>
                    <p>No videos found in the directory.</p>
                    <p style="opacity: 0.7; margin-top: 10px;">Make sure there are video files in /home/podlomar/Videos</p>
                </div>
            `;
      return;
    }

    // Create folder sections
    let html = `
            <div class="video-stats">
                <h3>📊 Library Stats</h3>
                <p>Total Videos: ${data.totalCount} | Folders: ${Object.keys(data.videosByFolder).length}</p>
            </div>
        `;

    // Sort folders alphabetically, but put 'Root' first
    const sortedFolders = Object.keys(data.videosByFolder).sort((a, b) => {
      if (a === 'Root') return -1;
      if (b === 'Root') return 1;
      return a.localeCompare(b);
    });

    for (const folder of sortedFolders) {
      const videos = data.videosByFolder[folder];
      const folderIcon = folder === 'Root' ? '🏠' : '📁';

      html += `
                <div class="folder-section">
                    <h3 class="folder-title">
                        ${folderIcon} ${folder} (${videos.length} videos)
                    </h3>
                    <div class="video-grid">
                        ${videos.map(video => `
                            <div class="video-item" data-video-path="${video.path}" data-video-name="${video.name}" data-video-relative="${video.relativePath}">
                                <div class="video-icon">🎬</div>
                                <div class="video-name">${this.escapeHtml(video.displayName)}</div>
                                <div class="video-details">
                                    <div class="video-extension">${this.getFileExtension(video.name).toUpperCase()}</div>
                                    <div class="video-size">${this.formatFileSize(video.size)}</div>
                                </div>
                                <div class="video-path">${this.escapeHtml(video.relativePath)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
    }

    this.videoList.innerHTML = html;

    // Add click event listeners to video items
    this.videoList.querySelectorAll('.video-item').forEach(item => {
      item.addEventListener('click', () => {
        const videoPath = item.dataset.videoPath;
        const videoName = item.dataset.videoName;
        const relativePath = item.dataset.videoRelative;
        this.playVideo(videoPath, videoName, relativePath, item);
      });
    });
  }

  playVideo(videoPath, videoName, relativePath, itemElement) {
    // Update active video styling
    this.videoList.querySelectorAll('.video-item').forEach(item => {
      item.classList.remove('active');
    });
    itemElement.classList.add('active');

    // Set video source and play
    this.videoPlayer.src = videoPath;
    this.videoPlayer.load();

    this.currentVideo = { path: videoPath, name: videoName, relativePath: relativePath };

    // Scroll to video player on mobile
    if (window.innerWidth <= 768) {
      this.videoPlayer.scrollIntoView({ behavior: 'smooth' });
    }
  }

  togglePlayPause() {
    if (this.videoPlayer.paused) {
      this.videoPlayer.play();
    } else {
      this.videoPlayer.pause();
    }
  }

  toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      this.videoPlayer.requestFullscreen().catch(err => {
        console.log('Error attempting to enable fullscreen:', err);
      });
    }
  }

  showLoading() {
    this.loadingMessage.style.display = 'block';
    this.videoList.innerHTML = '';
  }

  hideLoading() {
    this.loadingMessage.style.display = 'none';
  }

  showError(message) {
    this.errorMessage.textContent = message;
    this.errorMessage.style.display = 'block';
  }

  hideError() {
    this.errorMessage.style.display = 'none';
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  getFileExtension(filename) {
    return filename.split('.').pop() || '';
  }

  formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }
}

// Initialize the video player when the page loads
document.addEventListener('DOMContentLoaded', () => {
  new VideoPlayer();
});

// Add some nice console styling
console.log('%c🎬 HomeStream Video Player Loaded! 🎬',
  'color: #4a90e2; font-size: 16px; font-weight: bold;');
console.log('%cKeyboard shortcuts:', 'color: #666; font-weight: bold;');
console.log('Spacebar: Play/Pause');
console.log('F: Toggle fullscreen');
console.log('Left Arrow: Rewind 10s');
console.log('Right Arrow: Forward 10s');
