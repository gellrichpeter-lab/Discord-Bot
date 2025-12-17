# Discord Bot - Deployment Guide for Oracle Cloud (Ubuntu)

This folder contains all the files needed to deploy your Discord bot to an Ubuntu server.

## Files Included

- All command files (`commands/`)
- All event handlers (`events/`)
- All utility files (`utils/`) - **Modified for Linux**
- All tests (`__tests__/`)
- Configuration files (`package.json`, `package-lock.json`)
- Main entry point (`index.js`)
- Command deployment script (`deploy-commands.js`)
- Environment template (`.env.example`)
- Documentation (`CLAUDE.md`)

## Important Changes for Linux

The following files have been **automatically modified** for Linux deployment:

1. **utils/musicQueue.js** - Uses system `ffmpeg` and `yt-dlp` instead of Windows binaries
2. **commands/play.js** - Uses system `yt-dlp` instead of Windows binary
3. **commands/playlist.js** - Uses system `yt-dlp` instead of Windows binary

## Prerequisites on Ubuntu Server

You need to install these on your Ubuntu server:

```bash
# Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# FFmpeg (for audio processing)
sudo apt install -y ffmpeg

# yt-dlp (for YouTube/SoundCloud)
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp
```

## Deployment Steps

### 1. Upload this folder to your server

From your Windows PC (in PowerShell):
```powershell
scp -i path\to\your-key.key -r * ubuntu@YOUR_PUBLIC_IP:~/discordbot/
```

### 2. Connect to your server

```bash
ssh -i path/to/your-key.key ubuntu@YOUR_PUBLIC_IP
```

### 3. Install dependencies

```bash
cd ~/discordbot
npm install
```

### 4. Configure environment variables

```bash
# Copy the example file
cp .env.example .env

# Edit with your values
nano .env
```

Add your bot token, client ID, and optionally guild ID.

### 5. Deploy slash commands

```bash
node deploy-commands.js
```

### 6. Start the bot with PM2

```bash
# Install PM2
sudo npm install -g pm2

# Start bot
pm2 start index.js --name discordbot

# View logs
pm2 logs discordbot

# Check status
pm2 status
```

### 7. Configure auto-start on reboot

```bash
# Generate startup script
pm2 startup

# Copy and run the command it shows you

# Save current process list
pm2 save
```

## PM2 Commands

```bash
# View real-time logs
pm2 logs discordbot

# Restart bot
pm2 restart discordbot

# Stop bot
pm2 stop discordbot

# Remove from PM2
pm2 delete discordbot

# Monitor resources
pm2 monit
```

## Troubleshooting

### Bot not connecting
- Check logs: `pm2 logs discordbot`
- Verify .env file has correct token
- Ensure all dependencies installed: `npm install`

### Audio not playing
- Verify FFmpeg installed: `ffmpeg -version`
- Verify yt-dlp installed: `yt-dlp --version`
- Check PM2 logs for errors

### Commands not showing in Discord
- Run `node deploy-commands.js` again
- If using GUILD_ID, commands appear instantly
- Without GUILD_ID, can take up to 1 hour

## Support

For more information, see CLAUDE.md for bot architecture and features.
