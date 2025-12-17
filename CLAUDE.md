# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Discord bot built with discord.js v14 featuring slash commands and music playback functionality. Uses a modular command/event handler architecture with automatic loading and a centralized queue management system for multi-guild music streaming.

## Common Commands

**Start bot in development mode** (auto-restart on file changes):
```bash
npm run dev
```

**Start bot in production**:
```bash
npm start
```

**Deploy slash commands to Discord**:
```bash
npm run deploy
```

Run this after creating/modifying commands in `commands/` directory. If `GUILD_ID` is set in `.env`, commands deploy to that guild only (instant). Without `GUILD_ID`, commands deploy globally (up to 1 hour delay).

## Architecture

### Command System
- Commands stored in `commands/` directory
- Each command exports `data` (SlashCommandBuilder) and `execute` function
- Automatically loaded into `client.commands` Collection on startup via `index.js`
- Music commands (`play`, `pause`, `resume`, `skip`, `stop`, `queue`) interact with centralized queue manager
- New commands require deployment via `npm run deploy`

### Event System
- Events stored in `events/` directory
- Each event exports `name`, `once` (boolean), and `execute` function
- Automatically registered on bot startup
- `ready.js` - Bot connection event
- `voiceStateUpdate.js` - Auto-disconnects bot when all users leave voice channel

### Music System Architecture
Core music functionality is centralized in `utils/musicQueue.js`:

**QueueManager (Singleton)**
- Manages separate `MusicQueue` instances per guild
- Accessed via `require('../utils/musicQueue')` from commands
- Methods: `getQueue(guildId)`, `deleteQueue(guildId)`

**MusicQueue (Per-Guild)**
- Uses `@discordjs/voice` for voice connections and audio playback
- Maintains queue state: `songs[]`, `currentSong`, `isPlaying`, `connection`, `player`
- Auto-disconnects after 5 minutes of inactivity (no songs in queue)
- Automatically handles channel switching when user moves to different voice channel
- Methods:
  - `addSong(song)` - Adds song to queue
  - `play(voiceChannel)` - Joins channel and starts playback
  - `playNext()` - Plays next song from queue (triggered by AudioPlayer.Idle event)
  - `pause()`, `resume()`, `skip()`, `stop()`
  - `getQueue()`, `getCurrentSong()`, `isPaused()`

**Song Object Structure**
```js
{
  title: string,
  url: string,
  duration: number,
  thumbnail: string,
  requestedBy: string,
  info: object // Full play-dl video_info result (needed for streaming)
}
```

**Music Flow**
1. `/play` command validates YouTube URL and fetches video info via `play-dl`
2. Song object created with full `info` stored
3. Added to guild queue via `queueManager.getQueue(guildId).addSong(song)`
4. `queue.play(voiceChannel)` called to join voice and start playback
5. `playNext()` uses `play.stream_from_info(song.info)` to create audio stream
6. AudioPlayer events trigger automatic queue progression

### Main Entry Point (`index.js`)
- Loads environment variables via dotenv
- Creates Discord client with intents: Guilds, GuildMessages, MessageContent, GuildVoiceStates
- Initializes play-dl via `getFreeClientID()` before bot login (required for YouTube streaming)
- Dynamically loads commands from `commands/` into Collection
- Dynamically loads and registers events from `events/`
- Handles slash command interactions via `interactionCreate` event
- Includes error handling for commands, client errors, and unhandled promise rejections

### Command Deployment (`deploy-commands.js`)
- Reads all commands from `commands/` directory
- Uses Discord REST API to register commands
- Supports both guild-specific (instant, for testing) and global deployment (slower, production)

## Configuration

Environment variables in `.env`:
- `DISCORD_TOKEN` - Bot token from Discord Developer Portal
- `CLIENT_ID` - Application ID for command deployment
- `GUILD_ID` - Optional; if set, deploys commands to specific guild (instant), otherwise global (1hr delay)

Required Discord intents: Guilds, GuildMessages, MessageContent, GuildVoiceStates

## Dependencies

**Core**
- `discord.js` v14 - Discord API library
- `@discordjs/voice` - Voice connection and audio playback
- `@discordjs/opus` - Audio encoding
- `play-dl` - YouTube streaming library (primary)
- `dotenv` - Environment variable management

**Development**
- `nodemon` - Auto-restart on file changes

## Adding New Commands

1. Create file in `commands/` directory (e.g., `commands/example.js`)
2. Export object with `data` (SlashCommandBuilder) and `execute(interaction)` function
3. For music commands: import queue manager via `require('../utils/musicQueue')`
4. Run `npm run deploy` to register with Discord
5. Restart bot if running (`npm run dev` handles this automatically)

## Adding New Events

1. Create file in `events/` directory (e.g., `events/example.js`)
2. Export object with `name`, `once`, and `execute(...args)` function
3. Restart bot to load new event handler
