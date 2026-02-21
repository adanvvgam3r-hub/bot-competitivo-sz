const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChannelType } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simu')
        .setDescription('Simulador Alpha com Formação de Times')
        .addStringOption(o => o.setName('modo').setDescription('1v1 ou 2v2').setRequired(true).addChoices({name:'1v1',value:'1v1'},{name:'2v2',value:'2v2'}))
        .addStringOption(o => o.setName('versao').setDescription('Ex: guys, beast ou priv').setRequired(true))
        .addIntegerOption(o => o.setName('vagas').setDescription('Total de jogadores').setRequired(true).addChoices({name:'2',value:2},{name:'4',value:4},{name:'8',value:8}))
        .addStringOption(o => o.setName('mapa').setDescription('Mapa da partida').setRequired(true))
        .addIntegerOption(o => o.setName('expira').setDescription('Minutos para expirar').setRequired(true)),

    async execute(interaction) {
        const ID_STAFF = '1453126709447754010';
        const ID_CANAL_TOPICOS = '1474560305492394106';
        const criadorId = interaction.user.id;

        if (!interaction.member.roles.cache.has(ID_STAFF)) return interaction.reply({ content: '❌ Apenas Staff!', ephemeral: true });

        const modo = interaction.options.getString('modo');
        const vagas = interaction.options.getInteger('vagas');
        const expiraMin = interaction.options.getInteger('expira');
        
        let inscritos = []; // Lista bruta de IDs

        const gerarEmbed = (status = '🟢 ABERTO', cor = '#8b00ff') => {
            let timesTexto = "";
            const jogadoresPorTime = modo === '1v1' ? 1 : 2;
            const totalTimes = vagas / jogadoresPorTime;

            for (let i = 1; i <= totalTimes; i++) {
                const inicio = (i - 1) * jogadoresPorTime;
                const fim = i * jogadoresPorTime;
                const membros = inscritos.slice(inicio, fim);
                
                let linha = membros.length > 0 ? membros.map(id => `<@${id}>`).join(' | ') : 'ninguem ainda';
                timesTexto += `**Time ${i}:** ${linha}\n`;
            }

            return new EmbedBuilder()
                .setTitle(`🏆 SIMULADOR ${modo} - ${status}`)
                .setColor(cor)
                .setDescription(`**Times:**\n${timesTexto}`)
                .addFields(
                    { name: 'MAPA:', value: interaction.options.getString('mapa').toUpperCase(), inline: true },
                    { name: 'VERSÃO:', value: interaction.options.getString('versao').toUpperCase(), inline: true }
                )
                .setFooter({ text: `Progresso: (${inscritos.length}/${vagas}) alpha • Por ${interaction.user.username}` });
        };

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('inscrever').setLabel('INSCREVER-SE').setStyle(ButtonStyle.Primary)
        );

        const response = await interaction.reply({ embeds: [gerarEmbed()], components: [row] });

        const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: expiraMin * 60000 });

        collector.on('collect', async i => {
            // ⚡ RESPOSTA IMEDIATA PARA EVITAR ERRO DE INTERAÇÃO
            await i.deferUpdate();

            if (inscritos.includes(i.user.id)) return i.followUp({ content: '❌ Você já está inscrito!', ephemeral: true });
            if (inscritos.length >= vagas) return i.followUp({ content: '❌ Lotado!', ephemeral: true });

            inscritos.push(i.user.id);
            
            if (inscritos.length === vagas) {
                collector.stop('lotado');
            } else {
                await interaction.editReply({ embeds: [gerarEmbed()] });
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'lotado') {
                await interaction.editReply({ embeds: [gerarEmbed('✅ PRONTO', '#00ff00')], components: [] });
                
                // Lógica de criação de tópicos SimuCH aqui...
                // (Código anterior de criação de threads continua aqui)
                
            } else if (reason === 'time') {
                // 🔴 AO EXPIRAR: Muda cor, tira botão e avisa
                const embedExpirada = new EmbedBuilder()
                    .setTitle(`❌ SIMULADOR EXPIRADO`)
                    .setColor('#ff0000')
                    .setDescription('**STATUS:** O tempo acabou e o simulador foi cancelado.')
                    .setFooter({ text: 'Deletando mensagem em 30s...' });

                await interaction.editReply({ embeds: [embedExpirada], components: [] });
                
                setTimeout(() => {
                    interaction.deleteReply().catch(() => {});
                }, 30000);
            }
        });
    }
};
