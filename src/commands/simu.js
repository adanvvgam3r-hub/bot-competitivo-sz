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
        const ID_CARGO_STAFF = '1453128709447754010';

        // 🛡️ Trava de Segurança: Apenas Staff ou Dono
        if (!interaction.member.roles.cache.has(ID_CARGO_STAFF) && interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ 
                content: '❌ Você não tem o cargo **Organizar copa** para iniciar simuladores!', 
                ephemeral: true 
            });
        }

        const modo = interaction.options.getString('modo');
        const vagas = interaction.options.getInteger('vagas');
        const versao = interaction.options.getString('versao');
        const mapa = interaction.options.getString('mapa');

        const embedSimu = new EmbedBuilder()
            .setTitle(`🏆 SIMULADOR ${modo}`)
            .setColor('#8b00ff') // Roxo da sua imagem
            .addFields(
                { name: 'MAPA:', value: mapa.toUpperCase(), inline: true },
                { name: 'VERSÃO:', value: versao.toUpperCase(), inline: true },
                { name: 'VAGAS:', value: `${vagas} Jogadores`, inline: true },
                { name: 'STATUS:', value: '🟢 Inscrições Abertas', inline: false }
            )
            .setFooter({ text: `Progresso: (0/${vagas})` })
            .setTimestamp();

        // Aqui você pode adicionar botões de inscrição no futuro
        await interaction.reply({ embeds: [embedSimu] });
    }
};
