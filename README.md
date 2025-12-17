# ✅ Ready for Deployment

This folder contains your Discord bot prepared for deployment to Oracle Cloud Ubuntu server.

## 📦 What's Included

### Core Files
- `index.js` - Main bot entry point
- `deploy-commands.js` - Slash command deployment script
- `package.json` & `package-lock.json` - Dependencies

### Commands (10 total)
- `/play` - Play music from YouTube or SoundCloud
- `/playlist` - Add entire playlists (up to 200 songs)
- `/queue` - View current queue
- `/skip` - Skip current song
- `/stop` - Stop playback and clear queue
- `/pause` - Pause playback
- `/resume` - Resume playback
- `/ping` - Check bot latency
- `/debug` - Debug information
- `/cleanup` - Delete old bot messages

### Events
- `ready.js` - Bot startup
- `interactionCreate.js` - Handle slash commands & buttons
- `voiceStateUpdate.js` - Auto-disconnect when alone

### Utilities
- `constants.js` - Configuration values
- `embedBuilder.js` - Discord embed creators
- `musicQueue.js` - Music queue management (modified for Linux)
- `validators.js` - Input validation

### Configuration
- `.env.example` - Environment variables template
- `DEPLOYMENT.md` - Detailed deployment instructions
- `CLAUDE.md` - Bot architecture documentation

### Tests
- `__tests__/validators.test.js` - Unit tests (42 passing)

## 🔧 Linux Modifications

These files have been **automatically updated** to use system commands instead of Windows binaries:

✅ `utils/musicQueue.js` - Uses system `ffmpeg` and `yt-dlp`
✅ `commands/play.js` - Uses system `yt-dlp`
✅ `commands/playlist.js` - Uses system `yt-dlp`

## 🚀 Quick Start

### 1. Upload to Server

From Windows PowerShell:
```powershell
cd C:\Users\Peter\Documents\cODE\dISCORDbOT\deploy
scp -i path\to\your-key.key -r * ubuntu@YOUR_PUBLIC_IP:~/discordbot/
```

### 2. On Server

```bash
# Install dependencies
cd ~/discordbot
npm install

# Configure environment
cp .env.example .env
nano .env  # Add your bot token, client ID, guild ID

# Deploy commands
node deploy-commands.js

# Start with PM2
sudo npm install -g pm2
pm2 start index.js --name discordbot
pm2 logs discordbot
```

## 📋 Features

✅ YouTube & SoundCloud support
✅ Audio normalization for consistent volume
✅ Queue management (up to 200 songs)
✅ Playlist support (up to 200 songs)
✅ Auto-disconnect when alone
✅ Clickable song links in embeds
✅ Channel switching support
✅ Retry logic for failed streams
✅ FFmpeg audio processing
✅ Button controls (Skip/Stop)

## 📖 Full Instructions

See **DEPLOYMENT.md** for detailed step-by-step deployment instructions.

---

**Ready to deploy!** All Windows-specific paths have been converted to work on Linux.
