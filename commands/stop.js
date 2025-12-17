const { SlashCommandBuilder } = require('discord.js');
const queueManager = require('../utils/musicQueue');
const { createStoppedEmbed } = require('../utils/embedBuilder');
const { validateMusicPlaying } = require('../utils/validators');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop the music and clear the queue'),

    async execute(interaction) {
        const queue = queueManager.getQueue(interaction.guildId);

        // Validate music is playing
        const validation = validateMusicPlaying(queue);
        if (!validation.valid) {
            return interaction.reply({ content: validation.error, ephemeral: true });
        }

        // Get current song before stopping
        const stoppedSong = queue.getCurrentSong();
        queue.stop();

        // Create stopped embed
        const embed = createStoppedEmbed(stoppedSong);

        await interaction.reply({ embeds: [embed] });
    },
};
