const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('perfil')
        .setDescription('Perfil Alpha')
        .addUserOption(o => o.setName('quem').setDescription('Jogador')),

    async execute(interaction) {
        const target = interaction.options.getUser('quem') || interaction.user;
        const PATH = '/app/data/ranking.json';
        let d = { simuV: 0, simuP: 0, apV: 0, apP: 0, x1V: 0, x1P: 0 };

        if (fs.existsSync(PATH)) {
            const all = JSON.parse(fs.readFileSync(PATH, 'utf8'));
            if (all[target.id]) d = { ...d, ...all[target.id] };
        }

        const embed = new EmbedBuilder()
            .setTitle(`PERFIL ALPHA - ${target.username}`)
            .setThumbnail(target.displayAvatarURL())
            .setColor('#8b00ff')
            .addFields(
                { name: '🏆 SIMUS', value: `V: ${d.simuV} | Vice: ${d.simuP}`, inline: true },
                { name: '💰 AP', value: `V: ${d.apV} | P: ${d.apP}`, inline: true },
                { name: '⚔️ X1', value: `V: ${d.x1V} | P: ${d.x1P}`, inline: true }
            );
        await interaction.reply({ embeds: [embed] });
    }
};
