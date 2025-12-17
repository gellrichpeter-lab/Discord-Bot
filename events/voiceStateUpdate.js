const { VoiceConnectionStatus } = require('@discordjs/voice');
const queueManager = require('../utils/musicQueue');

module.exports = {
    name: 'voiceStateUpdate',
    once: false,
    execute(oldState, newState) {
        console.log(`[VOICE DEBUG] Event triggered - User: ${oldState.member.user.tag}`);
        console.log(`[VOICE DEBUG] Old channel: ${oldState.channel?.name || 'none'}, New channel: ${newState.channel?.name || 'none'}`);

        // Only process if someone left a channel (regardless of where they went)
        if (!oldState.channel) {
            console.log(`[VOICE DEBUG] User didn't leave a channel (joined new channel), ignoring`);
            return;
        }

        const guild = oldState.guild;
        const queue = queueManager.getQueue(guild.id);

        // Check if bot is connected and in a voice channel
        if (!queue.connection) {
            console.log(`[VOICE DEBUG] Bot has no connection in guild ${guild.id}`);
            return;
        }

        if (queue.connection.state.status === VoiceConnectionStatus.Destroyed) {
            console.log(`[VOICE DEBUG] Bot connection is destroyed in guild ${guild.id}`);
            return;
        }

        // Get the channel the bot is in
        const botChannelId = queue.connection.joinConfig.channelId;
        const botChannel = guild.channels.cache.get(botChannelId);

        console.log(`[VOICE DEBUG] Bot is in channel: ${botChannel?.name || 'unknown'} (${botChannelId})`);

        if (!botChannel) {
            console.log(`[VOICE DEBUG] Could not find bot channel`);
            return;
        }

        // Check if the person who left was in the same channel as the bot
        if (oldState.channel.id !== botChannelId) {
            console.log(`[VOICE DEBUG] User left different channel (${oldState.channel.name}), not bot's channel`);
            return;
        }

        console.log(`[VOICE DEBUG] User left bot's channel, checking remaining members...`);

        // Count real users (non-bots) currently in the bot's channel
        const humanMembers = botChannel.members.filter(member => !member.user.bot);

        console.log(`[VOICE DEBUG] Human members in bot channel: ${humanMembers.size}`);
        console.log(`[VOICE DEBUG] All members: ${botChannel.members.map(m => `${m.user.tag} (bot: ${m.user.bot})`).join(', ')}`);

        if (humanMembers.size === 0) {
            console.log(`[VOICE] All users left channel in guild ${guild.id}. Disconnecting bot.`);
            queue.stop();
        } else {
            console.log(`[VOICE] ${humanMembers.size} user(s) still in channel with bot in guild ${guild.id}`);
        }
    },
};
