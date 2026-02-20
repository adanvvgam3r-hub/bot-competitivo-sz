const { Client, GatewayIntentBits, Collection } = require('discord.js');
require('dotenv').config();

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.GuildMembers
    ] 
});

client.once('ready', () => {
    console.log('✅ Bot de Competitivo Online!');
});

// Aqui você vai importar a lógica dos comandos das outras pastas
client.login(process.env.TOKEN);

