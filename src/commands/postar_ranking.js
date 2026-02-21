const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('postar_ranking')
        .setDescription('Cria a mensagem fixa do Ranking')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🏆 RANKING GERAL - TOP 10')
            .setColor('#f1c40f')
            .setDescription('Aguardando a primeira final para atualizar...');

        const msg = await interaction.reply({ embeds: [embed], fetchReply: true });

        const config = { rankingChannelId: interaction.channel.id, rankingMessageId: msg.id };
        fs.writeFileSync('/app/data/ranking_config.json', JSON.stringify(config, null, 2));
        
        await interaction.followUp({ content: '✅ Ranking fixo configurado no Volume!', ephemeral: true });
    }
};
