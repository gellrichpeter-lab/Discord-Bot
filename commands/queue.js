const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const queueManager = require('../utils/musicQueue');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Show the current music queue'),

    async execute(interaction) {
        const queue = queueManager.getQueue(interaction.guildId);
        const currentSong = queue.getCurrentSong();
        const upcomingSongs = queue.getQueue();

        if (!currentSong && upcomingSongs.length === 0) {
            return interaction.reply({ content: 'The queue is empty!', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setColor(0x0099FF)
            .setTitle('Music Queue')
            .setTimestamp();

        if (currentSong) {
            embed.addFields({
                name: 'Now Playing',
                value: `**[${currentSong.title}](${currentSong.url})**\nRequested by: ${currentSong.requestedBy}`,
                inline: false
            });
        }

        if (upcomingSongs.length > 0) {
            const queueList = upcomingSongs
                .slice(0, 10)
                .map((song, index) => `${index + 1}. **[${song.title}](${song.url})** - ${song.requestedBy}`)
                .join('\n');

            embed.addFields({
                name: `Up Next (${upcomingSongs.length} song${upcomingSongs.length !== 1 ? 's' : ''})`,
                value: queueList,
                inline: false
            });

            if (upcomingSongs.length > 10) {
                embed.setFooter({ text: `And ${upcomingSongs.length - 10} more...` });
            }
        }

        await interaction.reply({ embeds: [embed] });
    },
};
