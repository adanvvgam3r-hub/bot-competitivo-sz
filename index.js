.const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMembers] });
client.commands = new Collection();

// 📂 INICIALIZAÇÃO DO VOLUME (RAILWAY /APP/DATA)
const DATA_DIR = '/app/data';
const dbFiles = ['ranking.json', 'partidas.json', 'ranking_config.json'];

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
dbFiles.forEach(f => {
    const p = path.join(DATA_DIR, f);
    if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8').length < 2) {
        fs.writeFileSync(p, JSON.stringify({}, null, 2));
    }
});

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
        console.log('✅ Sistema Alpha Online e Volume Montado!');
    } catch (e) { console.error(e); }
})();

client.on('interactionCreate', async i => {
    if (!i.isChatInputCommand()) return;
    const cmd = client.commands.get(i.commandName);
    if (cmd) await cmd.execute(i);
});

client.login(process.env.TOKEN);
