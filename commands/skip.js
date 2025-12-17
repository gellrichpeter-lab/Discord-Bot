const { SlashCommandBuilder } = require('discord.js');
const queueManager = require('../utils/musicQueue');
const { createSkippedEmbed, createStoppedEmbed, createMusicButtons } = require('../utils/embedBuilder');
const { validateMusicPlaying } = require('../utils/validators');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip the currently playing song'),

    async execute(interaction) {
        const queue = queueManager.getQueue(interaction.guildId);

        // Validate music is playing
        const validation = validateMusicPlaying(queue);
        if (!validation.valid) {
            return interaction.reply({ content: validation.error, ephemeral: true });
        }

        const currentSong = queue.getCurrentSong();
        const upcomingSongs = queue.getQueue();
        const nextSong = upcomingSongs.length > 0 ? upcomingSongs[0] : null;

        // If no next song, stop playback entirely
        if (!nextSong) {
            queue.stop();

            const embed = createStoppedEmbed(currentSong, 'Skipped');
            return interaction.reply({ embeds: [embed] });
        }

        // Skip to next song
        queue.skip();

        // Create skipped embed with next song info
        const embed = createSkippedEmbed(currentSong, nextSong);
        const row = createMusicButtons();

        await interaction.reply({ embeds: [embed], components: [row] });
    },
};
