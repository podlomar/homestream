# HomeStream - Local Video Player

A simple Node.js web application that allows you to stream and play videos from your local Videos folder on your network.

## Features

- 🎬 Browse and play videos from your local Videos folder
- 📱 Responsive design that works on desktop and mobile
- ⚡ Fast video streaming with range request support
- 🎮 Keyboard controls (Space, F, Arrow keys)
- 🔄 Refresh video library
- 📺 Fullscreen video playback
- 🌐 Access from any device on your local network

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
   - `http://localhost:3000` (local access)
   - `http://[your-ip]:3000` (network access - the server will display your IP when starting)

3. The application will automatically scan your `/home/podlomar/Videos` folder and display all compatible video files

## Configuration

If you want to use a different videos directory, edit the `VIDEOS_DIR` constant in `server.js`:

```javascript
const VIDEOS_DIR = '/path/to/your/videos';
```

## Keyboard Shortcuts

When a video is playing:
- **Spacebar**: Play/Pause
- **F**: Toggle fullscreen
- **Left Arrow**: Rewind 10 seconds
- **Right Arrow**: Forward 10 seconds

## Network Access

The server binds to `0.0.0.0:3000`, making it accessible from other devices on your local network. When you start the server, it will display the URLs you can use to access it from other devices.

## Security Note

This application is designed for local network use only. It serves files from your specified videos directory without authentication. Do not expose this server to the public internet.

## License

MIT License
