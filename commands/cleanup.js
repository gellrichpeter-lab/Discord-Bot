const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const queueManager = require('../utils/musicQueue');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('cleanup')
        .setDescription('Clean up and reset the music bot state'),

    async execute(interaction) {
        const queue = queueManager.getQueue(interaction.guildId);

        // Stop everything
        queue.stop();

        // Delete the queue entirely
        queueManager.deleteQueue(interaction.guildId);

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('🧹 Cleanup Complete')
            .setDescription('Bot state has been reset.')
            .addFields({
                name: 'Status',
                value: 'All queues cleared and connections reset.',
                inline: false
            })
            .setTimestamp();

        await interaction.reply({ embeds: [embed] });
    },
};
