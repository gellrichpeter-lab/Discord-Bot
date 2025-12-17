const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const queueManager = require('../utils/musicQueue');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('debug')
        .setDescription('Debug bot status'),

    async execute(interaction) {
        const queue = queueManager.getQueue(interaction.guildId);
        const voiceChannel = interaction.member.voice.channel;
        const currentSong = queue.getCurrentSong();

        const embed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle('🔧 Debug Information')
            .addFields(
                { name: 'Voice Channel', value: voiceChannel ? voiceChannel.name : 'Not in channel', inline: true },
                { name: 'Bot Connected', value: queue.connection ? '✅ Yes' : '❌ No', inline: true },
                { name: 'Is Playing', value: queue.isPlaying ? '✅ Yes' : '❌ No', inline: true },
                { name: 'Current Song', value: currentSong?.title || 'None', inline: false },
                { name: 'Songs in Queue', value: `${queue.getQueue().length}`, inline: true },
                { name: 'Is Paused', value: queue.isPaused() ? '✅ Yes' : '❌ No', inline: true }
            )
            .setTimestamp();

        if (queue.connection) {
            embed.addFields(
                { name: 'Connection Status', value: queue.connection.state.status, inline: true },
                { name: 'Channel ID', value: queue.connection.joinConfig.channelId, inline: true }
            );
        }

        if (currentSong?.thumbnail) {
            embed.setThumbnail(currentSong.thumbnail);
        }

        await interaction.reply({ embeds: [embed], ephemeral: true });
    },
};
