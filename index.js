const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers, GatewayIntentBits.MessageContent] });
client.commands = new Collection();

// 📂 CONFIGURAÇÃO DO VOLUME (RAILWAY)
const dataDir = '/app/data';
const files = ['ranking.json', 'partidas.json', 'ranking_config.json'];
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
files.forEach(f => {
    const p = path.join(dataDir, f);
    if (!fs.existsSync(p)) fs.writeFileSync(p, JSON.stringify({}));
});

// Handler de Comandos Automático
const commandsPath = path.join(__dirname, 'src/commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
const commandsJSON = [];

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    client.commands.set(command.data.name, command);
    commandsJSON.push(command.data.toJSON());
}

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
(async () => {
    try {
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commandsJSON });
        console.log('✅ Comandos e Volume carregados!');
    } catch (e) { console.error(e); }
})();

client.on('interactionCreate', async i => {
    if (!i.isChatInputCommand()) return;
    const cmd = client.commands.get(i.commandName);
    if (cmd) await cmd.execute(i);
});

client.login(process.env.TOKEN);
