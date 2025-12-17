const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

/**
 * Create music control buttons (Skip and Stop)
 */
function createMusicButtons() {
    return new ActionRowBuilder()
        .addComponents(
            new ButtonBuilder()
                .setCustomId('music_skip')
                .setLabel('⏭️ Skip')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('music_stop')
                .setLabel('⏹️ Stop')
                .setStyle(ButtonStyle.Danger)
        );
}

/**
 * Create a "Now Playing" embed for the /play command
 */
function createNowPlayingEmbed(song, upcomingSongs = []) {
    const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('🎵 Now Playing')
        .setDescription(`**[${song.title}](${song.url})**`)
        .addFields(
            { name: 'Requested by', value: song.requestedBy, inline: true },
            { name: 'Duration', value: `${Math.floor(song.duration / 60)}:${(song.duration % 60).toString().padStart(2, '0')}`, inline: true }
        )
        .setTimestamp();

    if (song.thumbnail) {
        embed.setThumbnail(song.thumbnail);
    }

    // Add queue preview
    if (upcomingSongs.length > 0) {
        const nextSongs = upcomingSongs.slice(0, 3).map((s, i) => `${i + 1}. [${s.title}](${s.url})`).join('\n');
        embed.addFields({
            name: `Up Next (${upcomingSongs.length} song${upcomingSongs.length !== 1 ? 's' : ''})`,
            value: nextSongs + (upcomingSongs.length > 3 ? `\n...and ${upcomingSongs.length - 3} more` : ''),
            inline: false
        });
    }

    return embed;
}

/**
 * Create an "Added to Queue" embed for the /play command
 */
function createQueuedEmbed(song, position, upcomingSongs = []) {
    const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('✅ Added to Queue')
        .setDescription(`**[${song.title}](${song.url})**`)
        .addFields(
            { name: 'Position in Queue', value: `${position}`, inline: true },
            { name: 'Requested by', value: song.requestedBy, inline: true }
        )
        .setTimestamp();

    if (song.thumbnail) {
        embed.setThumbnail(song.thumbnail);
    }

    // Add queue preview
    if (upcomingSongs.length > 0) {
        const nextSongs = upcomingSongs.slice(0, 3).map((s, i) => `${i + 1}. [${s.title}](${s.url})`).join('\n');
        embed.addFields({
            name: `Up Next (${upcomingSongs.length} song${upcomingSongs.length !== 1 ? 's' : ''})`,
            value: nextSongs + (upcomingSongs.length > 3 ? `\n...and ${upcomingSongs.length - 3} more` : ''),
            inline: false
        });
    }

    return embed;
}

/**
 * Create a "Skipped" embed (with next song)
 */
function createSkippedEmbed(skippedSong, nextSong) {
    const embed = new EmbedBuilder()
        .setColor(0xFF9900)
        .setTitle('⏭️ Skipped')
        .setDescription(`**[${skippedSong?.title || 'Unknown'}](${skippedSong?.url || 'https://youtube.com'})**`)
        .addFields({
            name: 'Now Playing',
            value: `**[${nextSong.title}](${nextSong.url})**`,
            inline: false
        })
        .setTimestamp();

    if (skippedSong?.thumbnail) {
        embed.setThumbnail(skippedSong.thumbnail);
    }

    if (nextSong.thumbnail) {
        embed.setImage(nextSong.thumbnail);
    }

    return embed;
}

/**
 * Create a "Stopped" embed (when skipping with no next song or using stop command)
 */
function createStoppedEmbed(stoppedSong, message = 'Playback stopped') {
    const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('⏹️ Stopped')
        .setDescription(stoppedSong ? `**[${stoppedSong.title}](${stoppedSong.url})**` : message)
        .addFields({
            name: 'Queue Status',
            value: stoppedSong && message.includes('Skipped') ? 'No more songs in queue. Playback stopped.' : 'Queue cleared.',
            inline: false
        })
        .setTimestamp();

    if (stoppedSong?.thumbnail) {
        embed.setThumbnail(stoppedSong.thumbnail);
    }

    return embed;
}

module.exports = {
    createMusicButtons,
    createNowPlayingEmbed,
    createQueuedEmbed,
    createSkippedEmbed,
    createStoppedEmbed
};
