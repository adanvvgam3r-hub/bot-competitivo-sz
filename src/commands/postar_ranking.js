const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('postar_ranking')
        .setDescription('🏆 Cria a mensagem fixa do Ranking que atualiza sozinha')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const RANK_CONFIG = '/app/data/ranking_config.json';

        const embed = new EmbedBuilder()
            .setTitle('🏆 RANKING GERAL - ALPHA')
            .setColor('#f1c40f')
            .setDescription('```md\n# Aguardando a primeira final para carregar os dados...\n```')
            .setFooter({ text: 'Atualizado em tempo real pela Staff' })
            .setTimestamp();

        // Envia a mensagem fixa
        const msg = await interaction.reply({ embeds: [embed], fetchReply: true });

        // Salva as coordenadas da mensagem no Volume do Railway
        const config = { 
            channelId: interaction.channel.id, 
            messageId: msg.id 
        };
        
        fs.writeFileSync(RANK_CONFIG, JSON.stringify(config, null, 2));
        
        await interaction.followUp({ content: '✅ **Mensagem de Ranking configurada!** Agora o bot sabe onde editar.', ephemeral: true });
    }
};
