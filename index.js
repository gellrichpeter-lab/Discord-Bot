require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');
const play = require('play-dl');
const { RATE_LIMIT, MESSAGES } = require('./utils/constants');

// Create a new Discord client with necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
    ]
});

// Create a collection to store commands
client.commands = new Collection();

// Create a Map to store command cooldowns
const cooldowns = new Map();

// Load commands from the commands directory
const commandsPath = path.join(__dirname, 'commands');
if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);

        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
            console.log(`[INFO] Loaded command: ${command.data.name}`);
        } else {
            console.log(`[WARNING] Command at ${filePath} is missing "data" or "execute" property.`);
        }
    }
}

// Load events from the events directory
const eventsPath = path.join(__dirname, 'events');
if (fs.existsSync(eventsPath)) {
    const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

    for (const file of eventFiles) {
        const filePath = path.join(eventsPath, file);
        const event = require(filePath);

        if (event.once) {
            client.once(event.name, (...args) => event.execute(...args));
        } else {
            client.on(event.name, (...args) => event.execute(...args));
        }
        console.log(`[INFO] Loaded event: ${event.name}`);
    }
}

// Ready event (using clientReady instead of ready to avoid deprecation warning)
client.once('clientReady', () => {
    console.log(`[READY] Logged in as ${client.user.tag}`);
    console.log(`[READY] Bot is online and ready!`);
});

// Interaction handler for slash commands
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`[ERROR] Command ${interaction.commandName} not found.`);
        return;
    }

    // Check cooldown
    const cooldownKey = `${interaction.user.id}-${interaction.commandName}`;

    if (cooldowns.has(cooldownKey)) {
        const expirationTime = cooldowns.get(cooldownKey);
        if (Date.now() < expirationTime) {
            const timeLeft = (expirationTime - Date.now()) / 1000;
            return interaction.reply({
                content: MESSAGES.COOLDOWN(timeLeft),
                ephemeral: true
            });
        }
    }

    cooldowns.set(cooldownKey, Date.now() + RATE_LIMIT.COOLDOWN_MS);
    setTimeout(() => cooldowns.delete(cooldownKey), RATE_LIMIT.COOLDOWN_MS);

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(`[ERROR] Error executing command ${interaction.commandName}:`, error);

        try {
            const errorMessage = { content: MESSAGES.ERROR_GENERIC, ephemeral: true };

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMessage);
            } else {
                await interaction.reply(errorMessage);
            }
        } catch (replyError) {
            console.error(`[ERROR] Could not send error message (interaction likely expired):`, replyError);
            // Interaction expired, nothing we can do
        }
    }
});

// Error handling
client.on('error', error => {
    console.error('[ERROR] Discord client error:', error);
});

process.on('unhandledRejection', error => {
    console.error('[ERROR] Unhandled promise rejection:', error);
});

// Initialize play-dl before logging in
(async () => {
    try {
        console.log('[INFO] Initializing play-dl for YouTube...');
        await play.getFreeClientID();
        console.log('[INFO] YouTube support initialized');
        console.log('[INFO] SoundCloud support via yt-dlp (no auth required)');
    } catch (error) {
        console.error('[ERROR] Failed to initialize play-dl:', error);
        console.log('[WARNING] YouTube playback may not work properly');
    }

    // Login to Discord
    await client.login(process.env.DISCORD_TOKEN);
})();
