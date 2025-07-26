# HomeStream - Local Video Player

A simple Node.js web application that allows you to stream and play videos from your local Videos folder on your network.

## Features

- 🎬 Browse and play videos from your local Videos folder recursively
- 📁 Organized folder view with video counts and file sizes
- 📱 **Mobile-first responsive design** optimized for phone viewing
- ⚡ Fast video streaming with range request support
- 🎮 Touch-friendly controls with keyboard shortcuts
- 🔄 Refresh video library
- 📺 Large full-screen video player (90%+ on mobile)
- ⏪⏩ Quick 15-second seeking controls that work in fullscreen
- 🌐 Access from any device on your local network
- ✨ Overlay controls that work perfectly in fullscreen mode

## Supported Video Formats

- MP4
- AVI
- MKV
- MOV
- WMV
- FLV
- WebM
- M4V

## Installation

1. Make sure you have Node.js installed on your system
2. Navigate to the project directory
3. Install dependencies:
   ```bash
   npm install
   ```

## Usage

1. Start the server:
   ```bash
   npm start
   ```
   
   Or for development with auto-restart:
   ```bash
   npm run dev
   ```

2. Open your browser and go to:
   - `http://localhost:3001` (local access)
   - `http://[your-ip]:3001` (network access - the server will display your IP when starting)

3. The application will automatically scan your `/home/podlomar/Videos` folder recursively and display all compatible video files organized by folder

## Configuration

If you want to use a different videos directory, edit the `VIDEOS_DIR` constant in `server.js`:

```javascript
const VIDEOS_DIR = '/path/to/your/videos';
```

## Keyboard Shortcuts

When a video is playing:
- **Spacebar**: Play/Pause
- **F**: Toggle fullscreen
- **Left Arrow**: Rewind 15 seconds
- **Right Arrow**: Forward 15 seconds

## Controls

- **Mobile Touch Controls**: Tap the video to show overlay controls on mobile devices
- **Overlay Controls**: Hover over the video (desktop) or tap (mobile) to see convenient overlay buttons for play/pause, seeking, and fullscreen
- **Fullscreen Controls**: Overlay controls work perfectly in fullscreen mode with auto-hide functionality
- **Main Controls**: Use the buttons below the video player for the same functions
- **Large Video Player**: The video player takes up 85-92% of the screen height on mobile for optimal viewing
- **Touch-Optimized**: Larger touch targets and mobile-friendly button sizes

## Network Access

The server binds to `0.0.0.0:3001`, making it accessible from other devices on your local network. When you start the server, it will display the URLs you can use to access it from other devices.

## Security Note

This application is designed for local network use only. It serves files from your specified videos directory without authentication. Do not expose this server to the public internet.

## License

MIT License
