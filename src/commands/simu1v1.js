const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simu1v1')
        .setDescription('Inicia um simulador 1v1 com lista de participantes')
        .addStringOption(o => o.setName('versao').setDescription('Ex: guys, beast ou priv').setRequired(true))
        .addIntegerOption(o => o.setName('vagas').setDescription('Total de jogadores').setRequired(true).addChoices({name:'2',value:2},{name:'4',value:4},{name:'8',value:8}))
        .addStringOption(o => o.setName('mapa').setDescription('Mapa da partida').setRequired(true))
        .addIntegerOption(o => o.setName('expira').setDescription('Minutos para expirar').setRequired(true)),

    async execute(interaction) {
        const ID_STAFF = '1453126709447754010';
        const ID_CONFRONTOS = '1474560305492394106';
        const PATH = '/app/data/ranking.json';
        const ORGANIZADOR_ID = interaction.user.id;

        if (!interaction.member.roles.cache.has(ID_STAFF)) return interaction.reply({ content: '❌ Staff apenas!', ephemeral: true });

        const vagas = interaction.options.getInteger('vagas');
        const versao = interaction.options.getString('versao').toUpperCase();
        const mapa = interaction.options.getString('mapa').toUpperCase();
        const expiraMin = interaction.options.getInteger('expira');
        let inscritos = [];

        // Função para gerar a Embed com a lista de participantes
        const gerarEmbed = () => {
            const listaParticipantes = inscritos.length > 0 
                ? inscritos.map(id => `- <@${id}>`).join('\n') 
                : '-';

            return new EmbedBuilder()
                .setTitle('🏆 SIMULADOR 1V1')
                .setColor('#8b00ff')
                .setDescription(`Expira em <t:${Math.floor((Date.now() + expiraMin * 60000) / 1000)}:R>`)
                .addFields(
                    { name: 'VERSÃO:', value: versao, inline: true },
                    { name: 'MAPA:', value: mapa, inline: true },
                    { name: 'PARTICIPANTES:', value: listaParticipantes, inline: false }
                )
                .setFooter({ text: `Vagas: ${inscritos.length}/${vagas}` });
        };

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('in_1v1').setLabel('ENTRAR').setStyle(ButtonStyle.Primary)
        );
        
        const res = await interaction.reply({ embeds: [gerarEmbed()], components: [row] });
        const col = res.createMessageComponentCollector({ time: expiraMin * 60000 });

        col.on('collect', async i => {
            if (inscritos.includes(i.user.id)) return i.reply({ content: 'Já inscrito!', ephemeral: true });
            if (inscritos.length >= vagas) return i.reply({ content: 'Vagas lotadas!', ephemeral: true });

            inscritos.push(i.user.id);
            
            if (inscritos.length === vagas) col.stop('lotado');
            else await i.update({ embeds: [gerarEmbed()] });
        });

        col.on('end', async (collected, reason) => {
            if (reason !== 'lotado') {
                return interaction.editReply({ content: '❌ Inscrições encerradas ou expiradas.', embeds: [], components: [] });
            }

            const players = [...inscritos].sort(() => Math.random() - 0.5);
            await interaction.editReply({ content: '⚔️ **Inscrições lotadas! Gerando confrontos...**', embeds: [gerarEmbed()], components: [] });

            const canal = interaction.guild.channels.cache.get(ID_CONFRONTOS);
            if (!canal) return console.log("Canal de confrontos não encontrado.");

            for (let i = 0; i < players.length; i += 2) {
                const idx = i/2; 
                const p1 = players[i]; 
                const p2 = players[i+1];

                const th = await canal.threads.create({ 
                    name: `1v1-Partida-${idx}`, 
                    type: ChannelType.PrivateThread 
                });

                await th.members.add(p1); 
                await th.members.add(p2);

                const bt = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`v1_${p1}_${idx}`).setLabel('Vencer P1').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`v1_${p2}_${idx}`).setLabel('Vencer P2').setStyle(ButtonStyle.Success)
                );

                const m = await th.send({ 
                    content: `⚔️ **CONFRONTO**\n<@${p1}> vs <@${p2}>\n**Organizador:** <@${ORGANIZADOR_ID}>`, 
                    components: [bt] 
                });

                const sCol = m.createMessageComponentCollector();

                sCol.on('collect', async b => {
                    if (b.user.id !== ORGANIZADOR_ID) {
                        return b.reply({ content: `❌ Apenas o organizador (<@${ORGANIZADOR_ID}>) pode declarar o vencedor!`, ephemeral: true });
                    }

                    const args = b.customId.split('_');
                    const vencedorId = args[1];
                    const perdedorId = vencedorId === p1 ? p2 : p1;
                    
                    const finalIdx = (vagas/2) - 1;
                    if (parseInt(args[2]) === finalIdx) {
                        const data = JSON.parse(fs.readFileSync(PATH, 'utf8'));
                        [vencedorId, perdedorId].forEach(id => { 
                            if(!data[id]) data[id] = { simuV:0, simuP:0, apV:0, apP:0, x1V:0, x1P:0 }; 
                        });
                        data[vencedorId].simuV += 1; 
                        data[perdedorId].simuP += 1;
                        fs.writeFileSync(PATH, JSON.stringify(data, null, 2));
                    }

                    await b.update({ content: `🏆 Vitória: <@${vencedorId}>`, components: [] });
                    setTimeout(() => th.delete().catch(() => {}), 10000);
                });
            }
        });
    }
};
