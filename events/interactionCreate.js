const queueManager = require('../utils/musicQueue');
const { createSkippedEmbed, createStoppedEmbed, createMusicButtons } = require('../utils/embedBuilder');
const { validateMusicPlaying } = require('../utils/validators');
const { MESSAGES } = require('../utils/constants');

module.exports = {
    name: 'interactionCreate',
    once: false,
    async execute(interaction) {
        // Handle button interactions
        if (interaction.isButton()) {
            try {
                const queue = queueManager.getQueue(interaction.guildId);

                // Validate music is playing
                const validation = validateMusicPlaying(queue);
                if (!validation.valid) {
                    return interaction.reply({ content: validation.error, ephemeral: true });
                }

                if (interaction.customId === 'music_skip') {
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

                } else if (interaction.customId === 'music_stop') {
                    const stoppedSong = queue.getCurrentSong();
                    queue.stop();

                    const embed = createStoppedEmbed(stoppedSong);
                    await interaction.reply({ embeds: [embed] });

                } else {
                    // Unknown button ID
                    console.warn(`[WARN] Unknown button ID: ${interaction.customId}`);
                    return;
                }
            } catch (error) {
                console.error('[ERROR] Button interaction error:', error);

                try {
                    const errorMsg = { content: MESSAGES.ERROR_BUTTON, ephemeral: true };
                    if (interaction.replied || interaction.deferred) {
                        await interaction.followUp(errorMsg);
                    } else {
                        await interaction.reply(errorMsg);
                    }
                } catch (replyError) {
                    console.error('[ERROR] Could not send button error message:', replyError);
                }
            }
        }
    },
};
