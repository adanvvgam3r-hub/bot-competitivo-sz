const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('postar_ranking')
        .setDescription('Posta a mensagem fixa do Ranking que será atualizada automaticamente')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🏆 RANKING GERAL - AGUARDANDO DADOS')
            .setColor('#f1c40f')
            .setDescription('O ranking será exibido assim que a primeira copa for finalizada!');

        const msg = await interaction.reply({ embeds: [embed], fetchReply: true });

        // Salva o ID da mensagem e do canal para o bot saber onde editar depois
        const config = { rankingChannelId: interaction.channel.id, rankingMessageId: msg.id };
        fs.writeFileSync('./ranking_config.json', JSON.stringify(config, null, 2));
    }
};
