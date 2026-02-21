const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('postar_ranking')
        .setDescription('🏆 Cria o Placar Geral em formato de Grade Profissional')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🏆 RANKING GERAL - COPA ALPHA')
            .setColor('#f1c40f')
            .setDescription('```md\nPOS  NOME            VITS   VICE\n---  ------------    ----   ----\n# Aguardando primeira final...\n```')
            .setFooter({ text: 'Atualizado automaticamente • Alpha System' });

        const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
        
        // Salva as coordenadas no Volume do Railway
        const config = { channelId: interaction.channel.id, messageId: msg.id };
        fs.writeFileSync('/app/data/ranking_config.json', JSON.stringify(config, null, 2));
    }
};
