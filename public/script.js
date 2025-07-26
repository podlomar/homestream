class VideoPlayer {
  constructor() {
    this.videoPlayer = document.getElementById('videoPlayer');
    this.videoList = document.getElementById('videoList');
    this.loadingMessage = document.getElementById('loadingMessage');
    this.errorMessage = document.getElementById('errorMessage');
    this.noVideoMessage = document.getElementById('noVideoMessage');
    this.refreshBtn = document.getElementById('refreshBtn');
    this.fullscreenBtn = document.getElementById('fullscreenBtn');
    this.videoOverlay = document.getElementById('videoOverlay');

    // Browse controls
    this.toggleViewBtn = document.getElementById('toggleViewBtn');
    this.toggleExpandBtn = document.getElementById('toggleExpandBtn');
    this.searchInput = document.getElementById('searchInput');

    // Overlay controls
    this.rewind15Btn = document.getElementById('rewind15Btn');
    this.playPauseBtn = document.getElementById('playPauseBtn');
    this.forward15Btn = document.getElementById('forward15Btn');
    this.overlayFullscreenBtn = document.getElementById('overlayFullscreenBtn');

    // Main controls
    this.rewind15BtnMain = document.getElementById('rewind15BtnMain');
    this.playPauseBtnMain = document.getElementById('playPauseBtnMain');
    this.forward15BtnMain = document.getElementById('forward15BtnMain');

    this.currentVideo = null;
    this.videos = [];
    this.filteredVideos = [];
    this.expandedFolders = new Set();
    this.isTreeView = false;
    this.allExpanded = false;

    // Video position tracking
    this.savePositionInterval = null;
    this.SAVE_INTERVAL = 5000; // Save position every 5 seconds
    this.MIN_DURATION_TO_SAVE = 30; // Only save for videos longer than 30 seconds
    this.RESUME_THRESHOLD = 0.95; // Don't resume if watched more than 95%

    this.initializeEventListeners();
    this.loadVideos();
  }

  initializeEventListeners() {
    this.refreshBtn.addEventListener('click', () => this.loadVideos());

    // Browse controls
    this.toggleViewBtn.addEventListener('click', () => this.toggleView());
    this.toggleExpandBtn.addEventListener('click', () => this.toggleExpandAll());
    this.searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));

    // Main control buttons
    this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
    this.rewind15BtnMain.addEventListener('click', () => this.rewind15());
    this.playPauseBtnMain.addEventListener('click', () => this.togglePlayPause());
    this.forward15BtnMain.addEventListener('click', () => this.forward15());

    // Overlay control buttons
    this.rewind15Btn.addEventListener('click', () => this.rewind15());
    this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
    this.forward15Btn.addEventListener('click', () => this.forward15());
    this.overlayFullscreenBtn.addEventListener('click', () => this.toggleFullscreen());

    this.videoPlayer.addEventListener('loadstart', () => {
      this.noVideoMessage.style.display = 'none';
      this.videoPlayer.style.display = 'block';
      this.videoOverlay.style.display = 'block';
      this.fullscreenBtn.style.display = 'inline-block';
      this.rewind15BtnMain.style.display = 'inline-block';
      this.playPauseBtnMain.style.display = 'inline-block';
      this.forward15BtnMain.style.display = 'inline-block';
    });

    // Touch/mobile events for overlay controls
    this.videoPlayer.addEventListener('touchstart', () => {
      this.showOverlayControls();
    });

    this.videoPlayer.addEventListener('touchend', () => {
      setTimeout(() => this.hideOverlayControls(), 3000);
    });

    // Fullscreen change events
    document.addEventListener('fullscreenchange', () => {
      this.handleFullscreenChange();
    });

    document.addEventListener('webkitfullscreenchange', () => {
      this.handleFullscreenChange();
    });

    document.addEventListener('mozfullscreenchange', () => {
      this.handleFullscreenChange();
    });

    // Video position tracking events
    this.videoPlayer.addEventListener('loadedmetadata', () => {
      this.resumeVideoPosition();
    });

    this.videoPlayer.addEventListener('timeupdate', () => {
      this.schedulePositionSave();
    });

    this.videoPlayer.addEventListener('pause', () => {
      this.saveVideoPosition();
    });

    this.videoPlayer.addEventListener('ended', () => {
      this.clearVideoPosition();
    });

    // Save position before page unload
    window.addEventListener('beforeunload', () => {
      this.saveVideoPosition();
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
            this.rewind15();
            break;
          case 'ArrowRight':
            e.preventDefault();
            this.forward15();
            break;
          case 'Escape':
            if (document.fullscreenElement) {
              e.preventDefault();
              document.exitFullscreen();
            }
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

    // Store the data for filtering
    this.allData = data;
    this.filteredVideos = data.videos;

    if (this.isTreeView) {
      this.renderTreeView(data);
    } else {
      this.renderGridView(data);
    }
  }

  renderGridView(data) {
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
                        ${videos.map(video => {
        const resumeData = this.getResumeData(video.path);
        const resumeIndicator = resumeData ?
          `<div class="resume-indicator" title="Resume from ${resumeData.timeString}">
                                    ▶️ ${resumeData.timeString} (${resumeData.progressPercent}%)
                                </div>` : '';

        return `
                            <div class="video-item ${resumeData ? 'has-resume' : ''}" data-video-path="${video.path}" data-video-name="${video.name}" data-video-relative="${video.relativePath}">
                                <div class="video-icon">🎬</div>
                                <div class="video-name">${this.escapeHtml(video.displayName)}</div>
                                <div class="video-details">
                                    <div class="video-extension">${this.getFileExtension(video.name).toUpperCase()}</div>
                                    <div class="video-size">${this.formatFileSize(video.size)}</div>
                                </div>
                                ${resumeIndicator}
                                <div class="video-path">${this.escapeHtml(video.relativePath)}</div>
                            </div>
                        `;
      }).join('')}
                    </div>
                </div>
            `;
    }

    this.videoList.innerHTML = html;
    this.videoList.className = 'video-grid';
    this.addVideoClickListeners();
  }

  renderTreeView(data) {
    // Create tree view with expandable folders
    let html = `
            <div class="video-stats">
                <h3>📊 Library Stats</h3>
                <p>Total Videos: ${data.totalCount} | Folders: ${Object.keys(data.videosByFolder).length}</p>
            </div>
            <div class="folder-tree">
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
      const isExpanded = this.expandedFolders.has(folder) || this.allExpanded;
      const toggleIcon = isExpanded ? '▼' : '▶';

      html += `
                <div class="folder-item">
                    <div class="folder-header ${isExpanded ? 'expanded' : ''}" data-folder="${folder}">
                        <span class="folder-toggle ${isExpanded ? 'expanded' : ''}">${toggleIcon}</span>
                        <span class="folder-icon">${folderIcon}</span>
                        <span class="folder-name">${folder}</span>
                        <span class="folder-count">(${videos.length} videos)</span>
                    </div>
                    <div class="folder-content ${isExpanded ? 'expanded' : ''}">
                        <div class="folder-videos">
                            ${videos.map(video => {
        const resumeData = this.getResumeData(video.path);
        const resumeIndicator = resumeData ?
          `<div class="resume-indicator" title="Resume from ${resumeData.timeString}">
                                        ▶️ ${resumeData.timeString} (${resumeData.progressPercent}%)
                                    </div>` : '';

        return `
                                <div class="video-item ${resumeData ? 'has-resume' : ''}" data-video-path="${video.path}" data-video-name="${video.name}" data-video-relative="${video.relativePath}">
                                    <div class="video-icon">🎬</div>
                                    <div class="video-name">${this.escapeHtml(video.displayName)}</div>
                                    <div class="video-details">
                                        <div class="video-extension">${this.getFileExtension(video.name).toUpperCase()}</div>
                                        <div class="video-size">${this.formatFileSize(video.size)}</div>
                                    </div>
                                    ${resumeIndicator}
                                    <div class="video-path">${this.escapeHtml(video.relativePath)}</div>
                                </div>
                            `;
      }).join('')}
                        </div>
                    </div>
                </div>
            `;
    }

    html += '</div>';
    this.videoList.innerHTML = html;
    this.videoList.className = 'folder-tree-container';
    this.addVideoClickListeners();
    this.addFolderClickListeners();
  }

  addVideoClickListeners() {
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

  addFolderClickListeners() {
    // Add click event listeners to folder headers
    this.videoList.querySelectorAll('.folder-header').forEach(header => {
      header.addEventListener('click', () => {
        const folder = header.dataset.folder;
        this.toggleFolder(folder);
      });
    });
  }

  toggleFolder(folder) {
    if (this.expandedFolders.has(folder)) {
      this.expandedFolders.delete(folder);
    } else {
      this.expandedFolders.add(folder);
    }
    this.renderVideoList(this.allData);
  }

  toggleView() {
    this.isTreeView = !this.isTreeView;
    this.toggleViewBtn.textContent = this.isTreeView ? '📋 Grid View' : '📁 Folder View';
    this.renderVideoList(this.allData);
  }

  toggleExpandAll() {
    this.allExpanded = !this.allExpanded;
    this.toggleExpandBtn.textContent = this.allExpanded ? '📁 Collapse All' : '📂 Expand All';

    if (this.allExpanded) {
      // Add all folders to expanded set
      Object.keys(this.allData.videosByFolder).forEach(folder => {
        this.expandedFolders.add(folder);
      });
    } else {
      // Clear expanded folders
      this.expandedFolders.clear();
    }

    if (this.isTreeView) {
      this.renderVideoList(this.allData);
    }
  }

  handleSearch(searchTerm) {
    if (!searchTerm.trim()) {
      this.renderVideoList(this.allData);
      return;
    }

    const filteredData = {
      videos: [],
      videosByFolder: {},
      totalCount: 0
    };

    // Filter videos by search term
    const searchLower = searchTerm.toLowerCase();

    for (const [folder, videos] of Object.entries(this.allData.videosByFolder)) {
      const filteredVideos = videos.filter(video =>
        video.displayName.toLowerCase().includes(searchLower) ||
        video.relativePath.toLowerCase().includes(searchLower) ||
        folder.toLowerCase().includes(searchLower)
      );

      if (filteredVideos.length > 0) {
        filteredData.videosByFolder[folder] = filteredVideos;
        filteredData.videos.push(...filteredVideos);
        filteredData.totalCount += filteredVideos.length;
      }
    }

    this.renderVideoList(filteredData);
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

  rewind15() {
    this.videoPlayer.currentTime = Math.max(0, this.videoPlayer.currentTime - 15);
  }

  forward15() {
    this.videoPlayer.currentTime = Math.min(this.videoPlayer.duration, this.videoPlayer.currentTime + 15);
  }

  toggleFullscreen() {
    if (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.mozCancelFullScreen) {
        document.mozCancelFullScreen();
      }
    } else {
      const element = this.videoPlayer;
      if (element.requestFullscreen) {
        element.requestFullscreen();
      } else if (element.webkitRequestFullscreen) {
        element.webkitRequestFullscreen();
      } else if (element.mozRequestFullScreen) {
        element.mozRequestFullScreen();
      }
    }
  }

  handleFullscreenChange() {
    const isFullscreen = !!(document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement);

    if (isFullscreen) {
      // In fullscreen mode
      this.videoOverlay.style.display = 'block';
      this.showOverlayControls();
      // Auto-hide controls after 3 seconds
      setTimeout(() => this.hideOverlayControls(), 3000);
    } else {
      // Exiting fullscreen
      this.videoOverlay.style.display = 'block';
      this.showOverlayControls();
    }
  }

  showOverlayControls() {
    if (this.videoOverlay) {
      this.videoOverlay.style.opacity = '1';
      this.videoOverlay.style.pointerEvents = 'all';
    }
  }

  hideOverlayControls() {
    if (this.videoOverlay && (document.fullscreenElement || document.webkitFullscreenElement || document.mozFullScreenElement)) {
      this.videoOverlay.style.opacity = '0';
      this.videoOverlay.style.pointerEvents = 'none';
    }
  }

  // Video position tracking methods
  getVideoKey(videoPath) {
    // Create a unique key for the video based on its path
    return `homestream_position_${btoa(videoPath).replace(/[^a-zA-Z0-9]/g, '')}`;
  }

  saveVideoPosition() {
    if (!this.currentVideo || !this.videoPlayer.duration) return;

    const currentTime = this.videoPlayer.currentTime;
    const duration = this.videoPlayer.duration;

    // Only save if video is longer than minimum duration and not near the end
    if (duration < this.MIN_DURATION_TO_SAVE) return;
    if (currentTime / duration > this.RESUME_THRESHOLD) {
      // Video is almost finished, clear the saved position
      this.clearVideoPosition();
      return;
    }

    const videoKey = this.getVideoKey(this.currentVideo.path);
    const positionData = {
      currentTime: currentTime,
      duration: duration,
      timestamp: Date.now(),
      videoName: this.currentVideo.name
    };

    try {
      localStorage.setItem(videoKey, JSON.stringify(positionData));
    } catch (e) {
      console.warn('Could not save video position:', e);
    }
  }

  resumeVideoPosition() {
    if (!this.currentVideo) return;

    const videoKey = this.getVideoKey(this.currentVideo.path);

    try {
      const savedData = localStorage.getItem(videoKey);
      if (!savedData) return;

      const positionData = JSON.parse(savedData);
      const savedTime = positionData.currentTime;
      const savedDuration = positionData.duration;

      // Only resume if the saved position is valid and recent (within 30 days)
      const isRecent = (Date.now() - positionData.timestamp) < (30 * 24 * 60 * 60 * 1000);
      const isValidPosition = savedTime > 10 && savedTime < (savedDuration * this.RESUME_THRESHOLD);

      if (isRecent && isValidPosition) {
        this.videoPlayer.currentTime = savedTime;
        this.showResumeNotification(savedTime);
      }
    } catch (e) {
      console.warn('Could not resume video position:', e);
    }
  }

  clearVideoPosition() {
    if (!this.currentVideo) return;

    const videoKey = this.getVideoKey(this.currentVideo.path);
    try {
      localStorage.removeItem(videoKey);
    } catch (e) {
      console.warn('Could not clear video position:', e);
    }
  }

  schedulePositionSave() {
    // Throttle saving to avoid too frequent localStorage writes
    if (this.savePositionInterval) return;

    this.savePositionInterval = setTimeout(() => {
      this.saveVideoPosition();
      this.savePositionInterval = null;
    }, this.SAVE_INTERVAL);
  }

  showResumeNotification(resumeTime) {
    const minutes = Math.floor(resumeTime / 60);
    const seconds = Math.floor(resumeTime % 60);
    const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;

    // Create or update notification
    let notification = document.getElementById('resumeNotification');
    if (!notification) {
      notification = document.createElement('div');
      notification.id = 'resumeNotification';
      notification.className = 'resume-notification';
      document.body.appendChild(notification);
    }

    notification.innerHTML = `
            <div class="resume-content">
                <span>▶️ Resumed from ${timeString}</span>
            </div>
        `;

    notification.style.display = 'block';

    // Auto-hide after 3 seconds
    setTimeout(() => {
      notification.style.display = 'none';
    }, 3000);
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

  getResumeData(videoPath) {
    const videoKey = this.getVideoKey(videoPath);

    try {
      const savedData = localStorage.getItem(videoKey);
      if (!savedData) return null;

      const positionData = JSON.parse(savedData);
      const savedTime = positionData.currentTime;
      const savedDuration = positionData.duration;

      // Check if the saved position is valid and recent (within 30 days)
      const isRecent = (Date.now() - positionData.timestamp) < (30 * 24 * 60 * 60 * 1000);
      const isValidPosition = savedTime > 10 && savedTime < (savedDuration * this.RESUME_THRESHOLD);

      if (isRecent && isValidPosition) {
        const minutes = Math.floor(savedTime / 60);
        const seconds = Math.floor(savedTime % 60);
        const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        const progressPercent = Math.round((savedTime / savedDuration) * 100);

        return {
          currentTime: savedTime,
          duration: savedDuration,
          timeString: timeString,
          progressPercent: progressPercent
        };
      }
    } catch (e) {
      console.warn('Could not get resume data:', e);
    }

    return null;
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
console.log('Left Arrow: Rewind 15s');
console.log('Right Arrow: Forward 15s');
