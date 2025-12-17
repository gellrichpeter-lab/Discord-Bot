require('dotenv').config();
const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const commands = [];
const commandsPath = path.join(__dirname, 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));

// Load all command data
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = require(filePath);
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
        console.log(`[INFO] Loaded command: ${command.data.name}`);
    } else {
        console.log(`[WARNING] Command at ${filePath} is missing "data" or "execute" property.`);
    }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

// Deploy commands
(async () => {
    try {
        console.log(`[INFO] Started refreshing ${commands.length} application (/) commands.`);

        // Check if GUILD_ID is set for testing
        if (process.env.GUILD_ID) {
            // Deploy to specific guild (faster, good for testing)
            const data = await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
                { body: commands },
            );
            console.log(`[SUCCESS] Successfully deployed ${data.length} guild commands to guild ${process.env.GUILD_ID}.`);
        } else {
            // Deploy globally (slower, but available in all guilds)
            const data = await rest.put(
                Routes.applicationCommands(process.env.CLIENT_ID),
                { body: commands },
            );
            console.log(`[SUCCESS] Successfully deployed ${data.length} global commands.`);
        }
    } catch (error) {
        console.error('[ERROR] Failed to deploy commands:', error);
    }
})();
