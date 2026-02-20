const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('limparsimu')
        .setDescription('Deleta todos os tópicos de confronto (SimuCH-) deste canal')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageThreads), // Apenas quem gerencia tópicos

    async execute(interaction) {
        const ID_CARGO_STAFF = '1453126709447754010';

        // 🛡️ Trava de segurança para o seu cargo de Staff
        if (!interaction.member.roles.cache.has(ID_CARGO_STAFF) && interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ content: '❌ Apenas a Staff pode limpar os confrontos!', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            // Pega todos os tópicos ativos e arquivados do canal
            const fetchedThreads = await interaction.channel.threads.fetch();
            const threadsParaDeletar = fetchedThreads.threads.filter(t => t.name.startsWith('SimuCH-'));

            if (threadsParaDeletar.size === 0) {
                return interaction.editReply('✅ Nenhum tópico com o prefixo **SimuCH-** foi encontrado neste canal.');
            }

            let contador = 0;
            for (const thread of threadsParaDeletar.values()) {
                await thread.delete().catch(err => console.log(`Erro ao deletar tópico: ${err}`));
                contador++;
            }

            await interaction.editReply(`🗑️ Sucesso! **${contador}** tópicos de simu foram removidos.`);
        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Ocorreu um erro ao tentar buscar ou deletar os tópicos.');
        }
    }
};
