/**
 * Validation Helpers
 * Reusable validation functions for common checks
 */

const { PERMISSIONS, MESSAGES } = require('./constants');

/**
 * Validate that user is in a voice channel
 * @param {Interaction} interaction - Discord interaction
 * @returns {Object} { valid: boolean, channel: VoiceChannel|null, error: string|null }
 */
function validateVoiceChannel(interaction) {
    const voiceChannel = interaction.member.voice.channel;

    if (!voiceChannel) {
        return {
            valid: false,
            channel: null,
            error: MESSAGES.NO_VOICE_CHANNEL,
        };
    }

    return {
        valid: true,
        channel: voiceChannel,
        error: null,
    };
}

/**
 * Validate that bot has required permissions in voice channel
 * @param {VoiceChannel} voiceChannel - Voice channel to check
 * @param {Client} client - Discord client
 * @returns {Object} { valid: boolean, error: string|null }
 */
function validateBotPermissions(voiceChannel, client) {
    const permissions = voiceChannel.permissionsFor(client.user);

    const hasAllPermissions = PERMISSIONS.REQUIRED.every(perm =>
        permissions.has(perm)
    );

    if (!hasAllPermissions) {
        return {
            valid: false,
            error: MESSAGES.NO_PERMISSIONS,
        };
    }

    return {
        valid: true,
        error: null,
    };
}

/**
 * Validate that music is currently playing
 * @param {MusicQueue} queue - Music queue instance
 * @returns {Object} { valid: boolean, error: string|null }
 */
function validateMusicPlaying(queue) {
    const currentSong = queue.getCurrentSong();
    const upcomingSongs = queue.getQueue();

    if (!currentSong && upcomingSongs.length === 0) {
        return {
            valid: false,
            error: MESSAGES.NO_MUSIC_PLAYING,
        };
    }

    return {
        valid: true,
        error: null,
    };
}

/**
 * Validate that a song is currently playing (stricter than music playing)
 * @param {MusicQueue} queue - Music queue instance
 * @returns {Object} { valid: boolean, currentSong: Object|null, error: string|null }
 */
function validateSongPlaying(queue) {
    const currentSong = queue.getCurrentSong();

    if (!currentSong) {
        return {
            valid: false,
            currentSong: null,
            error: MESSAGES.NO_SONG_PLAYING,
        };
    }

    return {
        valid: true,
        currentSong,
        error: null,
    };
}

/**
 * Validate YouTube URL or search query
 * @param {string} query - User input
 * @returns {Object} { isUrl: boolean, url: string|null, isPlaylist: boolean, playlistId: string|null, videoId: string|null }
 */
function validateYouTubeInput(query) {
    // Check for playlist URL
    const playlistMatch = query.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    const isPlaylist = !!playlistMatch;
    const playlistId = playlistMatch ? playlistMatch[1] : null;

    // Check for video URL
    const urlPatterns = [
        /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com|youtu\.be)\/(?:watch\?v=|embed\/|v\/|shorts\/)?([a-zA-Z0-9_-]{11})/,
    ];

    for (const pattern of urlPatterns) {
        const match = query.match(pattern);
        if (match) {
            // Build URL with playlist parameter if present
            let url = `https://www.youtube.com/watch?v=${match[1]}`;
            if (isPlaylist && playlistId) {
                url += `&list=${playlistId}`;
            }

            return {
                isUrl: true,
                url: url,
                isPlaylist,
                playlistId,
                videoId: match[1],
            };
        }
    }

    // Check if it's a playlist-only URL (no video ID)
    if (isPlaylist) {
        return {
            isUrl: true,
            url: `https://www.youtube.com/playlist?list=${playlistId}`,
            isPlaylist: true,
            playlistId,
            videoId: null,
        };
    }

    return {
        isUrl: false,
        url: null,
        isPlaylist: false,
        playlistId: null,
        videoId: null,
    };
}

/**
 * Validate SoundCloud URL
 * @param {string} query - User input
 * @returns {Object} { isUrl: boolean, url: string|null, isPlaylist: boolean, platform: string }
 */
function validateSoundCloudInput(query) {
    // SoundCloud URL patterns
    const soundCloudPatterns = [
        // Standard track URL: https://soundcloud.com/artist/track (with optional query params)
        /^(?:https?:\/\/)?(?:www\.)?soundcloud\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)(?:[\/\?].*)?$/,
        // SoundCloud short URL: https://on.soundcloud.com/...
        /^(?:https?:\/\/)?on\.soundcloud\.com\/[a-zA-Z0-9]+(?:\?.*)?$/,
        // SoundCloud mobile URL: https://m.soundcloud.com/...
        /^(?:https?:\/\/)?m\.soundcloud\.com\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)(?:[\/\?].*)?$/,
    ];

    for (const pattern of soundCloudPatterns) {
        if (pattern.test(query)) {
            // Normalize the URL to ensure it has protocol
            let normalizedUrl = query;
            if (!query.startsWith('http://') && !query.startsWith('https://')) {
                normalizedUrl = 'https://' + query;
            }

            // Check if it's a playlist/set
            const isPlaylist = normalizedUrl.includes('/sets/');

            return {
                isUrl: true,
                url: normalizedUrl,
                isPlaylist,
                platform: 'soundcloud',
            };
        }
    }

    return {
        isUrl: false,
        url: null,
        isPlaylist: false,
        platform: 'soundcloud',
    };
}

/**
 * Validate music input (YouTube or SoundCloud URL or search query)
 * @param {string} query - User input
 * @returns {Object} { platform: string, isUrl: boolean, url: string|null, isPlaylist: boolean, ... }
 */
function validateMusicInput(query) {
    // First check if it's a SoundCloud URL
    const soundCloudValidation = validateSoundCloudInput(query);
    if (soundCloudValidation.isUrl) {
        return {
            ...soundCloudValidation,
            platform: 'soundcloud',
        };
    }

    // Then check if it's a YouTube URL
    const youtubeValidation = validateYouTubeInput(query);
    if (youtubeValidation.isUrl) {
        return {
            ...youtubeValidation,
            platform: 'youtube',
        };
    }

    // If neither, it's a search query (default to YouTube)
    return {
        platform: 'youtube',
        isUrl: false,
        url: null,
        isPlaylist: false,
        playlistId: null,
        videoId: null,
    };
}

module.exports = {
    validateVoiceChannel,
    validateBotPermissions,
    validateMusicPlaying,
    validateSongPlaying,
    validateYouTubeInput,
    validateSoundCloudInput,
    validateMusicInput,
};
