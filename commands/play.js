const { SlashCommandBuilder } = require('discord.js');
const play = require('play-dl');
const queueManager = require('../utils/musicQueue');
const { createNowPlayingEmbed, createQueuedEmbed, createMusicButtons } = require('../utils/embedBuilder');
const { validateVoiceChannel, validateBotPermissions, validateMusicInput } = require('../utils/validators');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song from YouTube or SoundCloud')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('YouTube/SoundCloud URL or search query')
                .setRequired(true)),

    async execute(interaction) {
        // Validate voice channel
        const voiceValidation = validateVoiceChannel(interaction);
        if (!voiceValidation.valid) {
            return interaction.reply({ content: voiceValidation.error, ephemeral: true });
        }

        const voiceChannel = voiceValidation.channel;

        // Validate bot permissions
        const permissionValidation = validateBotPermissions(voiceChannel, interaction.client);
        if (!permissionValidation.valid) {
            return interaction.reply({ content: permissionValidation.error, ephemeral: true });
        }

        const query = interaction.options.getString('query');

        // Defer the reply to avoid timeout
        await interaction.deferReply();

        try {
            // Determine if input is URL or search query
            const musicValidation = validateMusicInput(query);
            let url;
            let platform = musicValidation.platform;

            if (musicValidation.isUrl) {
                // Handle YouTube playlists
                if (platform === 'youtube' && musicValidation.isPlaylist && !musicValidation.videoId) {
                    // Playlist URL without specific video - get first video
                    console.log('[DEBUG] YouTube playlist URL detected, fetching first video');
                    try {
                        const playlistInfo = await play.playlist_info(musicValidation.url);
                        const videos = await playlistInfo.all_videos();

                        if (!videos || videos.length === 0) {
                            return interaction.editReply('This playlist is empty or private!');
                        }

                        url = videos[0].url;
                        console.log('[DEBUG] Using first video from playlist:', url);
                    } catch (playlistError) {
                        console.error('[ERROR] Failed to fetch playlist:', playlistError);
                        return interaction.editReply('Failed to access playlist. It may be private or unavailable.');
                    }
                } else if (platform === 'youtube' && musicValidation.isPlaylist && musicValidation.videoId) {
                    // Playlist URL with specific video - just use that video
                    url = `https://www.youtube.com/watch?v=${musicValidation.videoId}`;
                    console.log('[DEBUG] Playlist URL with video ID, playing specific video');
                } else if (platform === 'soundcloud' && musicValidation.isPlaylist) {
                    // SoundCloud playlist - get first track
                    console.log('[DEBUG] SoundCloud playlist detected, fetching first track');
                    try {
                        const playlistInfo = await play.soundcloud(musicValidation.url);
                        if (playlistInfo.type !== 'playlist') {
                            return interaction.editReply('Could not load SoundCloud playlist!');
                        }
                        const tracks = await playlistInfo.all_tracks();
                        if (!tracks || tracks.length === 0) {
                            return interaction.editReply('This SoundCloud playlist is empty or private!');
                        }
                        url = tracks[0].url;
                        console.log('[DEBUG] Using first track from SoundCloud playlist:', url);
                    } catch (scError) {
                        console.error('[ERROR] Failed to fetch SoundCloud playlist:', scError);
                        return interaction.editReply('Failed to access SoundCloud playlist. It may be private or unavailable.');
                    }
                } else {
                    url = musicValidation.url;
                }
            } else {
                // Search YouTube (default)
                console.log('[DEBUG] Searching YouTube for:', query);
                const searchResults = await play.search(query, { limit: 1 });

                if (!searchResults || searchResults.length === 0) {
                    return interaction.editReply('No results found for your search!');
                }

                url = searchResults[0].url;
                platform = 'youtube';
            }

            // Get track information based on platform
            console.log('[DEBUG] Getting track info for URL:', url);
            let song;

            if (platform === 'soundcloud') {
                // For SoundCloud, use yt-dlp to get metadata (it supports SoundCloud natively)
                const YTDlpWrap = require('yt-dlp-wrap').default;
                const ytdlp = new YTDlpWrap('yt-dlp'); // Use system yt-dlp on Linux

                try {
                    // Get metadata from SoundCloud using yt-dlp
                    const metadata = await ytdlp.execPromise([
                        url,
                        '--dump-json',
                        '--no-warnings'
                    ]);
                    const info = JSON.parse(metadata);

                    song = {
                        title: info.title || 'Unknown Track',
                        url: url, // Keep original URL for yt-dlp to process later
                        duration: info.duration || 0,
                        thumbnail: info.thumbnail || null,
                        requestedBy: interaction.user.tag,
                        platform: 'soundcloud',
                    };
                    console.log('[DEBUG] SoundCloud track loaded:', song.title);
                } catch (scError) {
                    console.error('[ERROR] Failed to get SoundCloud metadata:', scError);
                    return interaction.editReply('Could not load SoundCloud track. It may be private or unavailable.');
                }
            } else {
                // YouTube - use yt-dlp to avoid bot detection
                const YTDlpWrap = require('yt-dlp-wrap').default;
                const ytdlp = new YTDlpWrap('yt-dlp'); // Use system yt-dlp on Linux

                try {
                    // Get metadata from YouTube using yt-dlp with cookies
                    const metadata = await ytdlp.execPromise([
                        url,
                        '--dump-json',
                        '--no-warnings',
                        '--no-config',
                        '--cookies', '/home/ubuntu/discordbot/youtube_cookies.txt'
                    ]);
                    const info = JSON.parse(metadata);

                    song = {
                        title: info.title || 'Unknown Video',
                        url: url,
                        duration: info.duration || 0,
                        thumbnail: info.thumbnail || null,
                        requestedBy: interaction.user.tag,
                        platform: 'youtube',
                    };
                    console.log('[DEBUG] YouTube video loaded:', song.title);
                } catch (ytError) {
                    console.error('[ERROR] Failed to get YouTube metadata:', ytError);
                    return interaction.editReply('Could not load YouTube video. It may be private or unavailable.');
                }
            }

            // Get queue and add song
            const queue = queueManager.getQueue(interaction.guildId);
            const queuePosition = queue.addSong(song);
            console.log('[DEBUG] Song queued at position:', queuePosition);

            // Attempt to start playback
            let startedPlaying = false;
            try {
                startedPlaying = await queue.play(voiceChannel);
                console.log('[DEBUG] queue.play() returned:', startedPlaying);
            } catch (voiceError) {
                console.error('[ERROR] Voice connection failed:', voiceError);
                // Remove the song from queue since connection failed
                queue.songs.pop();
                console.log('[DEBUG] Removed song from queue due to connection failure');
                await interaction.editReply(`Failed to join voice channel: ${voiceError.message}`);
                return;
            }

            // Get upcoming songs for embed
            const upcomingSongs = queue.getQueue();

            // Create appropriate embed based on whether playback started
            let embed;
            if (startedPlaying) {
                embed = createNowPlayingEmbed(song, upcomingSongs);
            } else {
                embed = createQueuedEmbed(song, queuePosition, upcomingSongs);
            }

            // Create action buttons
            const row = createMusicButtons();

            await interaction.editReply({ embeds: [embed], components: [row] });

        } catch (error) {
            console.error('[ERROR] Play command error:', error);
            console.error('[ERROR] Stack trace:', error.stack);
            await interaction.editReply(`An error occurred: ${error.message}`);
        }
    },
};
