const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');
require('dotenv').config();

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
client.commands = new Collection();

// 📂 Lendo a pasta de comandos automaticamente
const commandsPath = path.join(__dirname, 'src/commands');
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
const commandsJSON = [];

for (const file of commandFiles) {
	const filePath = path.join(commandsPath, file);
	const command = require(filePath);
	if ('data' in command && 'execute' in command) {
		client.commands.set(command.data.name, command);
		commandsJSON.push(command.data.toJSON());
	}
}

// 🚀 Registrando os Slash Commands no Discord
const rest = new REST().setToken(process.env.TOKEN);
(async () => {
	try {
		await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commandsJSON });
		console.log('✅ Comandos carregados com sucesso!');
	} catch (error) { console.error(error); }
})();

// 📥 Executando os comandos quando usados
client.on('interactionCreate', async interaction => {
	if (!interaction.isChatInputCommand()) return;
	const command = client.commands.get(interaction.commandName);
	if (!command) return;
	try { await command.execute(interaction); } 
    catch (error) { console.error(error); }
});

client.login(process.env.TOKEN);
