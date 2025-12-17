module.exports = {
    name: 'clientReady',
    once: true,
    execute(client) {
        console.log(`[READY] ${client.user.tag} is online!`);
        console.log(`[READY] Serving ${client.guilds.cache.size} guild(s)`);
    },
};
