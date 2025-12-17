/**
 * Application Constants
 * Centralized configuration values for the Discord music bot
 */

module.exports = {
    // Queue Configuration
    QUEUE: {
        MAX_SIZE: 200,
        MAX_RETRIES: 2,
        RETRY_DELAY_MS: 2000,
        INACTIVITY_TIMEOUT_MS: 5 * 60 * 1000, // 5 minutes
    },

    // Playlist Configuration
    PLAYLIST: {
        MAX_SIZE: 200, // Maximum songs to add from a playlist
    },

    // Rate Limiting
    RATE_LIMIT: {
        COOLDOWN_MS: 3000, // 3 seconds
    },

    // Audio Configuration
    AUDIO: {
        DEFAULT_VOLUME: 0.7,
        SAMPLE_RATE: '48000',
        CHANNELS: '2',
        FORMAT: 's16le',
        // Audio Normalization Settings
        NORMALIZATION: {
            ENABLED: true, // Enable/disable loudness normalization
            TARGET_LUFS: -16, // Target loudness in LUFS (-23 to -13 typical)
            TARGET_LRA: 11, // Target loudness range
            TARGET_TP: -1.5, // True peak limit in dB
            // Note: Videos <2 hours use 'loudnorm' (accurate, slow)
            //       Videos ≥2 hours use 'dynaudnorm' (fast, real-time)
        },
    },

    // FFmpeg Configuration
    FFMPEG: {
        RECONNECT: '1',
        RECONNECT_STREAMED: '1',
        RECONNECT_DELAY_MAX: '5',
        ANALYZE_DURATION: '0',
        LOG_LEVEL: '0',
    },

    // YT-DLP Configuration
    YTDLP: {
        FORMAT: 'bestaudio',
        FLAGS: ['--get-url', '--no-warnings', '--no-playlist', '--no-config', '--cookies', '/home/ubuntu/discordbot/youtube_cookies.txt'],
    },

    // Platform Support
    PLATFORMS: {
        YOUTUBE: 'youtube',
        SOUNDCLOUD: 'soundcloud',
    },

    // Discord Permissions
    PERMISSIONS: {
        REQUIRED: ['Connect', 'Speak'],
    },

    // Embed Colors (hex values)
    COLORS: {
        PRIMARY: 0x0099FF,    // Blue - Now Playing, Queue
        SUCCESS: 0x00FF00,    // Green - Cleanup
        WARNING: 0xFF9900,    // Orange - Skipped
        ERROR: 0xFF0000,      // Red - Stopped, Errors
        DEBUG: 0x9B59B6,      // Purple - Debug info
        SOUNDCLOUD: 0xFF5500, // SoundCloud orange
    },

    // Messages
    MESSAGES: {
        NO_VOICE_CHANNEL: 'You need to be in a voice channel to play music!',
        NO_PERMISSIONS: 'I need permissions to join and speak in your voice channel!',
        NO_MUSIC_PLAYING: 'There is no music playing!',
        NO_SONG_PLAYING: 'There is no song playing!',
        QUEUE_EMPTY: 'The queue is empty!',
        QUEUE_FULL: (max) => `Queue is full! Maximum ${max} songs allowed.`,
        COOLDOWN: (timeLeft) => `Please wait ${timeLeft.toFixed(1)}s before using this command again.`,
        ERROR_GENERIC: 'There was an error executing this command!',
        ERROR_BUTTON: 'An error occurred processing your request.',
        VOICE_CONNECTION_FAILED: (error) => `Failed to join voice channel: ${error}`,
        PLAYLIST_USE_COMMAND: 'This is a playlist URL! Use `/playlist` to add the entire playlist, or `/play` to play just the first song.',
        PLAYLIST_TOO_LARGE: (count, max) => `Playlist has ${count} songs, but only ${max} can be added. Adding first ${max} songs.`,
        PLAYLIST_EMPTY: 'This playlist is empty or private!',
        PLAYLIST_NOT_ENOUGH_SPACE: (needed, available) => `Not enough space in queue! Playlist needs ${needed} slots, but only ${available} available.`,
        SOUNDCLOUD_NOT_FOUND: 'Could not find that SoundCloud track!',
        SOUNDCLOUD_PRIVATE: 'This SoundCloud track is private or unavailable!',
        PLATFORM_DETECTED: (platform) => `Detected ${platform} link`,
    },
};
