const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('limpar-rank')
        .setDescription('Reseta todas as estatísticas do ranking (Apenas Staff)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const ID_CARGO_STAFF = '1453126709447754010';
        const RANK_PATH = '/app/data/ranking.json';
        const CONFIG_PATH = '/app/data/ranking_config.json';

        // 🛡️ Verificação de segurança
        if (!interaction.member.roles.cache.has(ID_CARGO_STAFF)) {
            return interaction.reply({ content: '❌ Erro de permissão interna.', ephemeral: true });
        }

        // 1. Reseta o arquivo JSON para vazio
        fs.writeFileSync(RANK_PATH, JSON.stringify({}, null, 2));

        // 2. Atualiza a mensagem fixa do Ranking automaticamente
        try {
            if (fs.existsSync(CONFIG_PATH)) {
                const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
                const channel = await interaction.guild.channels.fetch(config.channelId);
                const msg = await channel.messages.fetch(config.messageId);

                // Recria a interface limpa
                const embedLimpa = EmbedBuilder.from(msg.embeds[0])
                    .setDescription('```md\nPOS  NOME            VITS   VICE\n---  ------------    ----   ----\n# Aguardando primeira final...\n```')
                    .setTimestamp();

                await msg.edit({ embeds: [embedLimpa] });
            }
        } catch (err) {
            console.log("Aviso: Mensagem de ranking não encontrada para reset visual.");
        }

        await interaction.reply({ content: '⚠️ **O Ranking e o Placar Geral foram resetados!**', ephemeral: true });
    }
};
