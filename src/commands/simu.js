const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simu')
        .setDescription('Inicia um simulador de Stumble Guys')
        .addStringOption(opt => opt.setName('modo').setDescription('1v1 ou 2v2').setRequired(true).addChoices({name:'1v1',value:'1v1'},{name:'2v2',value:'2v2'}))
        .addStringOption(opt => opt.setName('versao').setDescription('Ex: guys, beast ou priv').setRequired(true))
        .addIntegerOption(opt => opt.setName('vagas').setDescription('Quantidade de vagas').setRequired(true).addChoices({name:'4',value:4},{name:'8',value:8},{name:'16',value:16}))
        .addStringOption(opt => opt.setName('mapa').setDescription('Mapa da partida').setRequired(true))
        .addIntegerOption(opt => opt.setName('expira').setDescription('Minutos para cancelar automaticamente').setRequired(true)),

    async execute(interaction) {
        const ID_CARGO_ORGANIZADOR = '1453126709447754010';
        const ID_CARGO_ADVERTENCIA = '1467222875399393421';

        // 🛡️ Travas de Segurança
        if (interaction.member.roles.cache.has(ID_CARGO_ADVERTENCIA)) {
            return interaction.reply({ content: '❌ Você possui uma **Advertência** e não pode criar simuladores!', ephemeral: true });
        }
        if (!interaction.member.roles.cache.has(ID_CARGO_ORGANIZADOR) && interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ content: '❌ Apenas quem tem o cargo **Organizar copa** pode usar este comando!', ephemeral: true });
        }

        const modo = interaction.options.getString('modo');
        const versao = interaction.options.getString('versao');
        const vagas = interaction.options.getInteger('vagas');
        const mapa = interaction.options.getString('mapa').toUpperCase();
        const expiraMinutos = interaction.options.getInteger('expira');
        
        let inscritos = [];

        // Função para atualizar a Embed visualmente
        const gerarEmbed = (status = '🟢 Inscrições Abertas', cor = '#8b00ff') => {
            return new EmbedBuilder()
                .setTitle(`🏆 SIMULADOR ${modo}`)
                .setColor(cor)
                .addFields(
                    { name: 'MAPA:', value: mapa, inline: true },
                    { name: 'VERSÃO:', value: versao.toUpperCase(), inline: true },
                    { name: 'EXPIRA EM:', value: `${expiraMinutos} min`, inline: true },
                    { name: 'INSCRITOS:', value: inscritos.length > 0 ? inscritos.map(id => `<@${id}>`).join(', ') : 'Ninguém ainda', inline: false }
                )
                .setFooter({ text: `Progresso: (${inscritos.length}/${vagas}) • Organizado por ${interaction.user.username}` });
        };

        const botao = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('inscrever').setLabel('INSCREVER-SE').setStyle(ButtonStyle.Primary)
        );

        const response = await interaction.reply({ embeds: [gerarEmbed()], components: [botao] });

        // ⏱️ Coletor de Botões (Expira conforme o tempo definido no Slash)
        const collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: expiraMinutos * 60000 
        });

        collector.on('collect', async i => {
            if (inscritos.includes(i.user.id)) {
                return i.reply({ content: 'Você já está inscrito neste simulador!', ephemeral: true });
            }
            if (inscritos.length >= vagas) {
                return i.reply({ content: 'Este simulador já lotou!', ephemeral: true });
            }

            inscritos.push(i.user.id);
            
            // Se lotar, para o coletor
            if (inscritos.length === vagas) {
                collector.stop('lotado');
                await i.update({ embeds: [gerarEmbed('✅ LOTADO', '#00ff00')], components: [] });
            } else {
                await i.update({ embeds: [gerarEmbed()] });
            }
        });

        collector.on('end', (collected, reason) => {
            if (reason === 'time') {
                const embedExpirada = gerarEmbed('❌ CANCELADO (TEMPO ESGOTADO)', '#ff0000');
                interaction.editReply({ embeds: [embedExpirada], components: [] });
            }
        });
    }
};
