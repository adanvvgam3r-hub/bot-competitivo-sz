const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simu1v1')
        .setDescription('Inicia um simulador 1v1')
        .addStringOption(o => o.setName('versao').setDescription('guys, beast...').setRequired(true))
        .addIntegerOption(o => o.setName('vagas').setDescription('Total de players').setRequired(true).addChoices({name:'2',value:2},{name:'4',value:4},{name:'8',value:8}))
        .addStringOption(o => o.setName('mapa').setDescription('Mapa').setRequired(true))
        .addIntegerOption(o => o.setName('expira').setDescription('Minutos').setRequired(true)),

    async execute(interaction) {
        const ID_STAFF = '1453126709447754010';
        const ID_CONFRONTOS = '1474560305492394106';
        const PATH = '/app/data/ranking.json';

        if (!interaction.member.roles.cache.has(ID_STAFF)) return interaction.reply({ content: '❌ Staff apenas!', ephemeral: true });

        const vagas = interaction.options.getInteger('vagas');
        const mapa = interaction.options.getString('mapa').toUpperCase();
        let inscritos = [];

        const embed = () => new EmbedBuilder().setTitle('🏆 SIMU 1V1').setColor('#8b00ff').addFields({name:'MAPA', value:mapa, inline:true}).setFooter({text:`Inscritos: ${inscritos.length}/${vagas}`});
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('in_1v1').setLabel('ENTRAR').setStyle(ButtonStyle.Primary));
        
        const res = await interaction.reply({ embeds: [embed()], components: [row] });
        const col = res.createMessageComponentCollector({ time: interaction.options.getInteger('expira') * 60000 });

        col.on('collect', async i => {
            if (inscritos.includes(i.user.id)) return i.reply({ content: 'Já inscrito!', ephemeral: true });
            inscritos.push(i.user.id);
            if (inscritos.length === vagas) col.stop('lotado');
            else await i.update({ embeds: [embed()] });
        });

        col.on('end', async (collected, reason) => {
            if (reason !== 'lotado') return interaction.editReply({ content: '❌ Expirado.', embeds: [], components: [] });

            const players = [...inscritos].sort(() => Math.random() - 0.5);
            await interaction.editReply({ content: '⚔️ **Sorteio realizado! Tópicos criados.**', embeds: [], components: [] });

            const canal = interaction.guild.channels.cache.get(ID_CONFRONTOS);
            for (let i = 0; i < players.length; i += 2) {
                const idx = i/2; const p1 = players[i]; const p2 = players[i+1];
                const th = await canal.threads.create({ name: `1v1-Partida-${idx}`, type: ChannelType.PrivateThread });
                await th.members.add(p1); await th.members.add(p2);

                const bt = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`v1_${p1}_${idx}`).setLabel('Vencer P1').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`v1_${p2}_${idx}`).setLabel('Vencer P2').setStyle(ButtonStyle.Success)
                );

                const m = await th.send({ content: `⚔️ <@${p1}> vs <@${p2}>`, components: [bt] });
                const sCol = m.createMessageComponentCollector();

                sCol.on('collect', async b => {
                    if (!b.member.roles.cache.has(ID_STAFF)) return b.reply({ content: 'Apenas Staff!', ephemeral: true });
                    const vencedorId = b.customId.split('_')[1];
                    const perdedorId = vencedorId === p1 ? p2 : p1;
                    
                    // Lógica Ranking Final
                    const finalIdx = (vagas/2) - 1;
                    if (parseInt(b.customId.split('_')[2]) === finalIdx) {
                        const data = JSON.parse(fs.readFileSync(PATH, 'utf8'));
                        [vencedorId, perdedorId].forEach(id => { if(!data[id]) data[id] = { simuV:0, simuP:0, apV:0, apP:0, x1V:0, x1P:0 }; });
                        data[vencedorId].simuV += 1; data[perdedorId].simuP += 1;
                        fs.writeFileSync(PATH, JSON.stringify(data, null, 2));
                    }

                    await b.update({ content: `🏆 Vitória: <@${vencedorId}>`, components: [] });
                    setTimeout(() => th.delete().catch(() => {}), 10000);
                });
            }
        });
    }
};
