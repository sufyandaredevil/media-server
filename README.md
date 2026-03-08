# MEx (Media Explorer)

MEx is a lightweight, web-based media server designed for streaming your local video and audio library through a browser. It features a modern, responsive explorer interface, secure access control, and organized media playback.

## Features

- **HTTP Relay Streaming**: Efficiently stream video (`.mp4`, `.mkv`, `.webm`) and audio (`.mp3`, `.wav`, `.ogg`, etc.) files via HTTP range requests, allowing for seekable playback and reduced bandwidth usage.
- **File Explorer**: A tree-view interface to navigate your media library with ease.
- **Search**: Quickly find specific files within the current directory.
- **Secure Access**: Optional access key authentication via environment variables.
- **Login Rate Limiting**: Prevents brute-force attacks with configurable cooldowns and attempt limits.
- **Activity Logging**: Real-time console logs for requests and server status using `morgan`.
- **Subtitles Support**: Automatically detects and loads `.vtt` subtitle files for videos.

- **Responsive Design**: Works beautifully on both desktop and mobile browsers.
- **Customizable Exclusions**: Define rules to hide specific files or folders from the explorer.

## Tech Stack

- **Backend**: Node.js, Express
- **Frontend**: Vanilla JavaScript, CSS, HTML
- **Utilities**: `dotenv` (configuration), `cookie-parser` (authentication), `ignore` (file filtering), `express-rate-limit` (security), `morgan` (logging)


## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version 12 or higher recommended)

### Installation

1. Clone or download this repository.
2. Navigate to the project directory and install dependencies:
   ```bash
   npm install
   ```

### Configuration

Create a `.env` file in the root directory and set your access key:

```env
MEX_ACCESS_KEY=your_secret_key_here
ROOT_DIR="D:/Path/To/Your/Media"
PORT=3000

# Optional Security Settings
LOGIN_COOLDOWN_MINUTES=15
MAX_LOGIN_ATTEMPTS=5
SESSION_EXPIRY_DAYS=30
RATE_LIMIT_CLEANUP_MINUTES=5
```



> [!NOTE]
> If `MEX_ACCESS_KEY` is not set, the server will be publicly accessible.

Start the server by providing the absolute path to your media directory:

```bash
node server.js "D:/Path/To/Your/Media"
```

Alternatively, if `ROOT_DIR` is defined in your `.env` file, you can start the server without any arguments:

```bash
node server.js
```

The server will be available at [http://localhost:3000](http://localhost:3000) (defaults to `80` if `PORT` is not set in `.env` file) 

> [!TIP]
> If you want to access your media server securely from anywhere without opening ports on your router, consider using [Tailscale](https://tailscale.com/). 


## Project Structure

```text
media-server/
├── middleware/       # Authentication logic
├── public/           # Static assets (client-side JS, CSS)
├── routes/           # Express routes (API, streaming, views)
├── utils/            # Helper functions (file system operations)
├── views/            # HTML templates (index, login)
├── config.js         # Centralized configuration
├── rate-limits.json  # Persistent rate limit data
├── rules.json        # File exclusion patterns
├── server.js         # Application entry point
└── package.json      # Dependencies and metadata

```

## Usage

1. **Login**: If an access key is configured, enter it on the login page.
2. **Navigate**: Use the sidebar explorer to browse your folders.
3. **Play**: Click on a media file to start playback in the main window.
4. **Search**: Use the search bar in the explorer to filter files by name.
5. **Autoplay**: The player will automatically play the next media file in the current directory when the current one ends.

## Exclusion Rules

You can hide specific files or directories by adding patterns to `rules.json`. The syntax follows `.gitignore` rules.

Example `rules.json`:
```json
{
  "exclude": [
    "**/private/**",
    "*.tmp",
    "System Volume Information"
  ]
}
```
