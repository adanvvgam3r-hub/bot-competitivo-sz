const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('postar_ranking')
        .setDescription('Cria a mensagem fixa do Ranking que atualiza sozinha')
        // 🛡️ TRAVA DE INVISIBILIDADE: Apenas ADMs veem o comando na lista
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const ID_CARGO_STAFF = '1453126709447754010';
        const CONF_PATH = '/app/data/ranking_config.json';

        // Verificação dupla por ID de cargo
        if (!interaction.member.roles.cache.has(ID_CARGO_STAFF)) {
            return interaction.reply({ content: '❌ Apenas a Staff pode configurar o ranking fixo!', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('🏆 RANKING GERAL - TOP 10')
            .setColor('#f1c40f')
            .setDescription('Aguardando a primeira final para carregar os dados...');

        const msg = await interaction.reply({ embeds: [embed], fetchReply: true });

        const config = { 
            rankingChannelId: interaction.channel.id, 
            rankingMessageId: msg.id 
        };

        fs.writeFileSync(CONF_PATH, JSON.stringify(config, null, 2));
        
        await interaction.followUp({ content: '✅ Ranking fixo configurado com sucesso!', ephemeral: true });
    }
};
