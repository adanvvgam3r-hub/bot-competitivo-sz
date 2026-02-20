const { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simu')
        .setDescription('Inicia um simulador de Stumble Guys')
        .addStringOption(opt => 
            opt.setName('modo')
                .setDescription('Escolha entre 1v1 ou 2v2')
                .setRequired(true)
                .addChoices({ name: '1v1', value: '1v1' }, { name: '2v2', value: '2v2' }))
        .addStringOption(opt => 
            opt.setName('versao')
                .setDescription('Versão do jogo (Ex: V.0.64)')
                .setRequired(true))
        .addIntegerOption(opt => 
            opt.setName('vagas')
                .setDescription('Quantidade de participantes')
                .setRequired(true)
                .addChoices({ name: '4', value: 4 }, { name: '8', value: 8 }, { name: '16', value: 16 }))
        .addStringOption(opt => 
            opt.setName('mapa')
                .setDescription('Mapa da partida')
                .setRequired(true)),

    async execute(interaction) {
        // IDs fornecidos por você
        const ID_CARGO_ORGANIZADOR = '1453126709447754010';
        const ID_CARGO_ADVERTENCIA = '1467222875399393421';

        const temCargoStaff = interaction.member.roles.cache.has(ID_CARGO_ORGANIZADOR);
        const temAdvertencia = interaction.member.roles.cache.has(ID_CARGO_ADVERTENCIA);
        const isOwner = interaction.user.id === interaction.guild.ownerId;

        // 1. BLOQUEIO DE ADVERTÊNCIA (Prioridade Máxima)
        if (temAdvertencia) {
            return interaction.reply({ 
                content: '❌ Você possui uma **Advertência Nível 1** e está impedido de organizar simuladores!', 
                ephemeral: true 
            });
        }

        // 2. PERMISSÃO APENAS PARA STAFF OU DONO
        if (!temCargoStaff && !isOwner) {
            return interaction.reply({ 
                content: '❌ Apenas quem tem o cargo **Organizar copa** pode usar este comando!', 
                ephemeral: true 
            });
        }

        // PEGAR OPÇÕES DO COMANDO
        const modo = interaction.options.getString('modo');
        const vagas = interaction.options.getInteger('vagas');
        const versao = interaction.options.getString('versao');
        const mapa = interaction.options.getString('mapa');

        // CRIAR A EMBED (Visual Roxo da Copa SZ)
        const embedSimu = new EmbedBuilder()
            .setTitle(`🏆 SIMULADOR ${modo}`)
            .setColor('#8b00ff')
            .addFields(
                { name: 'MAPA:', value: mapa.toUpperCase(), inline: true },
                { name: 'VERSÃO:', value: versao.toUpperCase(), inline: true },
                { name: 'VAGAS:', value: `${vagas} Jogadores`, inline: true },
                { name: 'STATUS:', value: '🟢 Inscrições Abertas', inline: false }
            )
            .setFooter({ text: `Progresso: (0/${vagas}) • Organizado por ${interaction.user.username}` })
            .setTimestamp();

        // RESPOSTA FINAL
        await interaction.reply({ embeds: [embedSimu] });
    }
};
