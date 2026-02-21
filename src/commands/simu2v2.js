const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simu2v2')
        .setDescription('Inicia um simulador 2v2 com lista de participantes')
        .addStringOption(o => o.setName('versao').setDescription('Ex: guys, beast ou priv').setRequired(true))
        .addIntegerOption(o => o.setName('vagas').setDescription('Total de jogadores (Ex: 4 = 2 duplas)').setRequired(true).addChoices({name:'4',value:4},{name:'8',value:8}))
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

        const gerarEmbed = () => {
            const listaParticipantes = inscritos.length > 0 
                ? inscritos.map(id => `- <@${id}>`).join('\n') 
                : '-';

            return new EmbedBuilder()
                .setTitle('🏆 SIMULADOR 2V2')
                .setColor('#2ecc71') // Verde para diferenciar do 1v1
                .setDescription(`Expira em <t:${Math.floor((Date.now() + expiraMin * 60000) / 1000)}:R>`)
                .addFields(
                    { name: 'VERSÃO:', value: versao, inline: true },
                    { name: 'MAPA:', value: mapa, inline: true },
                    { name: 'PARTICIPANTES:', value: listaParticipantes, inline: false }
                )
                .setFooter({ text: `Vagas: ${inscritos.length}/${vagas}` });
        };

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('in_2v2').setLabel('ENTRAR').setStyle(ButtonStyle.Primary)
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
            if (reason !== 'lotado') return interaction.editReply({ content: '❌ Inscrições encerradas.', embeds: [], components: [] });

            const players = [...inscritos].sort(() => Math.random() - 0.5);
            await interaction.editReply({ content: '⚔️ **Times formados! Gerando tópicos de 2v2...**', embeds: [gerarEmbed()], components: [] });

            const canal = interaction.guild.channels.cache.get(ID_CONFRONTOS);
            for (let i = 0; i < players.length; i += 4) {
                const idx = i/4; 
                const timeA = [players[i], players[i+1]];
                const timeB = [players[i+2], players[i+3]];

                const th = await canal.threads.create({ name: `2v2-Duelo-${idx}`, type: ChannelType.PrivateThread });
                [...timeA, ...timeB].forEach(id => th.members.add(id).catch(() => {}));

                const bt = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`v2_a_${idx}`).setLabel('Vencer Time A').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`v2_b_${idx}`).setLabel('Vencer Time B').setStyle(ButtonStyle.Success)
                );

                const m = await th.send({ 
                    content: `⚔️ **CONFRONTO 2V2**\n**TIME A:** <@${timeA[0]}> & <@${timeA[1]}>\n**VS**\n**TIME B:** <@${timeB[0]}> & <@${timeB[1]}>\n\n**Organizador:** <@${ORGANIZADOR_ID}>`, 
                    components: [bt] 
                });

                const sCol = m.createMessageComponentCollector();

                sCol.on('collect', async b => {
                    if (b.user.id !== ORGANIZADOR_ID) {
                        return b.reply({ content: `❌ Apenas o organizador (<@${ORGANIZADOR_ID}>) pode declarar o vencedor!`, ephemeral: true });
                    }
                    
                    const venceuA = b.customId.includes('_a_');
                    const vTime = venceuA ? timeA : timeB;
                    const pTime = venceuA ? timeB : timeA;

                    // Final: idx 0 para 4 vagas, idx 1 para 8 vagas
                    const finalIdx = (vagas === 4) ? 0 : 1;
                    if (parseInt(b.customId.split('_')[2]) === finalIdx) {
                        const data = JSON.parse(fs.readFileSync(PATH, 'utf8'));
                        [...vTime, ...pTime].forEach(id => { if(!data[id]) data[id] = { simuV:0, simuP:0, apV:0, apP:0, x1V:0, x1P:0 }; });
                        vTime.forEach(id => data[id].simuV += 1);
                        pTime.forEach(id => data[id].simuP += 1);
                        fs.writeFileSync(PATH, JSON.stringify(data, null, 2));
                    }

                    await b.update({ content: `🏆 Vitória da Dupla: <@${vTime[0]}> & <@${vTime[1]}>`, components: [] });
                    setTimeout(() => th.delete().catch(() => {}), 10000);
                });
            }
        });
    }
};
