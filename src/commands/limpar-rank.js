const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('limpar-rank')
        .setDescription('Reseta todas as estatísticas do ranking (Apenas Staff)')
        // 🛡️ O comando só aparece para quem tem permissão de Administrador
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const ID_CARGO_STAFF = '1453126709447754010';
        const RANK_PATH = '/app/data/ranking.json';

        // Verificação extra de segurança por ID de cargo
        if (!interaction.member.roles.cache.has(ID_CARGO_STAFF)) {
            return interaction.reply({ content: '❌ Erro de permissão interna.', ephemeral: true });
        }

        fs.writeFileSync(RANK_PATH, JSON.stringify({}, null, 2));
        await interaction.reply({ content: '⚠️ **Ranking resetado com sucesso!**', ephemeral: true });
    }
};
