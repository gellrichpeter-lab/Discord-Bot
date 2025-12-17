const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const play = require('play-dl');
const queueManager = require('../utils/musicQueue');
const { validateVoiceChannel, validateBotPermissions, validateMusicInput } = require('../utils/validators');
const { PLAYLIST, QUEUE, COLORS, MESSAGES } = require('../utils/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('playlist')
        .setDescription('Add an entire YouTube or SoundCloud playlist to the queue')
        .addStringOption(option =>
            option.setName('url')
                .setDescription('YouTube/SoundCloud playlist URL')
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

        const playlistUrl = interaction.options.getString('url');

        // Defer the reply to avoid timeout
        await interaction.deferReply();

        try {
            // Validate that it's a playlist URL
            const musicValidation = validateMusicInput(playlistUrl);

            if (!musicValidation.isPlaylist) {
                return interaction.editReply('This is not a playlist URL! Use `/play` for individual songs.');
            }

            const platform = musicValidation.platform;
            console.log(`[DEBUG] Fetching ${platform} playlist info`);

            // Get playlist information
            let playlistInfo;
            let tracks;

            try {
                if (platform === 'soundcloud') {
                    // For SoundCloud playlists, use yt-dlp (supports SoundCloud natively)
                    const YTDlpWrap = require('yt-dlp-wrap').default;
                    const ytdlp = new YTDlpWrap('yt-dlp'); // Use system yt-dlp on Linux

                    // Get playlist metadata from SoundCloud using yt-dlp
                    const metadata = await ytdlp.execPromise([
                        musicValidation.url,
                        '--dump-json',
                        '--flat-playlist',
                        '--no-warnings'
                    ]);

                    // Parse playlist entries
                    const entries = metadata.trim().split('\n').map(line => JSON.parse(line));

                    if (entries.length === 0) {
                        return interaction.editReply(MESSAGES.PLAYLIST_EMPTY);
                    }

                    // Create mock playlistInfo and tracks for compatibility
                    playlistInfo = {
                        name: entries[0].playlist_title || 'SoundCloud Playlist',
                        thumbnail: entries[0].thumbnail || null,
                    };

                    tracks = entries.map(entry => ({
                        name: entry.title,
                        url: entry.url || `https://soundcloud.com${entry.id}`,
                        durationInSec: entry.duration || 0,
                        thumbnail: entry.thumbnail,
                    }));
                } else {
                    // YouTube - use yt-dlp to avoid bot detection
                    const YTDlpWrap = require('yt-dlp-wrap').default;
                    const ytdlp = new YTDlpWrap('yt-dlp'); // Use system yt-dlp on Linux

                    // Get playlist metadata from YouTube using yt-dlp
                    const metadata = await ytdlp.execPromise([
                        musicValidation.url,
                        '--dump-json',
                        '--flat-playlist',
                        '--no-warnings'
                    ]);

                    // Parse playlist entries
                    const entries = metadata.trim().split('\n').map(line => JSON.parse(line));

                    if (entries.length === 0) {
                        return interaction.editReply(MESSAGES.PLAYLIST_EMPTY);
                    }

                    // Create mock playlistInfo and tracks for compatibility
                    playlistInfo = {
                        title: entries[0].playlist_title || entries[0].playlist || 'YouTube Playlist',
                        thumbnail: { url: entries[0].thumbnail || null },
                    };

                    tracks = entries.map(entry => ({
                        title: entry.title,
                        url: entry.url || `https://www.youtube.com/watch?v=${entry.id}`,
                        durationInSec: entry.duration || 0,
                        thumbnails: [{ url: entry.thumbnail }],
                    }));
                }
            } catch (error) {
                console.error('[ERROR] Failed to fetch playlist:', error);
                return interaction.editReply('Failed to access playlist. It may be private or unavailable.');
            }

            if (!tracks || tracks.length === 0) {
                return interaction.editReply(MESSAGES.PLAYLIST_EMPTY);
            }

            console.log(`[DEBUG] Playlist has ${tracks.length} ${platform === 'soundcloud' ? 'tracks' : 'videos'}`);

            // Get queue and check available space
            const queue = queueManager.getQueue(interaction.guildId);
            const currentQueueSize = queue.getQueue().length;
            const availableSpace = QUEUE.MAX_SIZE - currentQueueSize;

            if (availableSpace === 0) {
                return interaction.editReply(MESSAGES.QUEUE_FULL(QUEUE.MAX_SIZE));
            }

            // Determine how many songs we can add
            const tracksToAdd = Math.min(tracks.length, PLAYLIST.MAX_SIZE, availableSpace);

            if (tracks.length > tracksToAdd) {
                console.log(`[DEBUG] Limiting playlist to ${tracksToAdd} songs (available space: ${availableSpace})`);
            }

            // Add songs to queue
            let addedCount = 0;
            const failedSongs = [];

            for (let i = 0; i < tracksToAdd; i++) {
                const track = tracks[i];

                try {
                    const song = {
                        title: platform === 'soundcloud' ? track.name : track.title,
                        url: track.url,
                        duration: track.durationInSec,
                        thumbnail: platform === 'soundcloud' ? track.thumbnail : track.thumbnails[0]?.url,
                        requestedBy: interaction.user.tag,
                        platform: platform,
                    };

                    queue.addSong(song);
                    addedCount++;
                } catch (error) {
                    console.error(`[ERROR] Failed to add song ${track.title || track.name}:`, error);
                    failedSongs.push(track.title || track.name);
                }
            }

            // Start playing if not already playing
            let startedPlaying = false;
            if (addedCount > 0) {
                try {
                    startedPlaying = await queue.play(voiceChannel);
                } catch (voiceError) {
                    console.error('[ERROR] Voice connection failed:', voiceError);
                    // Songs were added but couldn't connect - remove them
                    for (let i = 0; i < addedCount; i++) {
                        queue.songs.pop();
                    }
                    return interaction.editReply(`Failed to join voice channel: ${voiceError.message}`);
                }
            }

            // Create response embed
            const embedColor = platform === 'soundcloud' ? COLORS.SOUNDCLOUD : COLORS.SUCCESS;
            const platformEmoji = platform === 'soundcloud' ? '🔊' : '✅';
            const playlistTitle = platform === 'soundcloud' ? playlistInfo.name : playlistInfo.title;

            const embed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(`${platformEmoji} Playlist Added`)
                .setDescription(`**${playlistTitle}**`)
                .addFields(
                    { name: 'Songs Added', value: `${addedCount} of ${tracks.length}`, inline: true },
                    { name: 'Requested by', value: interaction.user.tag, inline: true },
                    { name: 'Platform', value: platform.charAt(0).toUpperCase() + platform.slice(1), inline: true }
                )
                .setTimestamp();

            if (playlistInfo.thumbnail) {
                const thumbnailUrl = platform === 'soundcloud' ? playlistInfo.thumbnail : playlistInfo.thumbnail.url;
                embed.setThumbnail(thumbnailUrl);
            }

            // Add warnings if applicable
            const warnings = [];
            if (tracks.length > PLAYLIST.MAX_SIZE) {
                warnings.push(`⚠️ Playlist limit: Only first ${PLAYLIST.MAX_SIZE} songs added`);
            }
            if (tracksToAdd < tracks.length && tracks.length <= PLAYLIST.MAX_SIZE) {
                warnings.push(`⚠️ Queue space: Only ${availableSpace} slots available`);
            }
            if (failedSongs.length > 0) {
                warnings.push(`⚠️ ${failedSongs.length} song(s) failed to add`);
            }

            if (warnings.length > 0) {
                embed.addFields({ name: 'Warnings', value: warnings.join('\n'), inline: false });
            }

            // Show queue info
            const upcomingSongs = queue.getQueue();
            if (upcomingSongs.length > 0) {
                const nextSongs = upcomingSongs.slice(0, 3).map((s, i) => `${i + 1}. [${s.title}](${s.url})`).join('\n');
                embed.addFields({
                    name: `Queue (${upcomingSongs.length} song${upcomingSongs.length !== 1 ? 's' : ''})`,
                    value: nextSongs + (upcomingSongs.length > 3 ? `\n...and ${upcomingSongs.length - 3} more` : ''),
                    inline: false
                });
            }

            await interaction.editReply({ embeds: [embed] });

        } catch (error) {
            console.error('[ERROR] Playlist command error:', error);
            console.error('[ERROR] Stack trace:', error.stack);
            await interaction.editReply(`An error occurred: ${error.message}`);
        }
    },
};
