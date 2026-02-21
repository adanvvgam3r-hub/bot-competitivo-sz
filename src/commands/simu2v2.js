const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simu2v2')
        .setDescription('Inicia um simulador 2v2')
        .addStringOption(o => o.setName('versao').setDescription('guys, beast...').setRequired(true))
        .addIntegerOption(o => o.setName('vagas').setDescription('Total (4 ou 8 jogadores)').setRequired(true).addChoices({name:'4 (2 duplas)',value:4},{name:'8 (4 duplas)',value:8}))
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

        const embed = () => new EmbedBuilder().setTitle('🏆 SIMU 2V2').setColor('#2ecc71').addFields({name:'MAPA', value:mapa, inline:true}).setFooter({text:`Inscritos: ${inscritos.length}/${vagas}`});
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('in_2v2').setLabel('ENTRAR EM DUPLA').setStyle(ButtonStyle.Primary));
        
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
            await interaction.editReply({ content: '⚔️ **Duplas formadas! Tópicos de 2v2 criados.**', embeds: [], components: [] });

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

                const m = await th.send({ content: `⚔️ **TIME A:** <@${timeA[0]}> & <@${timeA[1]}>\n**VS**\n**TIME B:** <@${timeB[0]}> & <@${timeB[1]}>`, components: [bt] });
                const sCol = m.createMessageComponentCollector();

                sCol.on('collect', async b => {
                    if (!b.member.roles.cache.has(ID_STAFF)) return b.reply({ content: 'Apenas Staff!', ephemeral: true });
                    
                    const venceuA = b.customId.includes('_a_');
                    const vTime = venceuA ? timeA : timeB;
                    const pTime = venceuA ? timeB : timeA;

                    // Se for a final (idx 0 para 4 vagas, idx 1 para 8 vagas)
                    const finalIdx = (vagas === 4) ? 0 : 1;
                    if (parseInt(b.customId.split('_')[2]) === finalIdx) {
                        const data = JSON.parse(fs.readFileSync(PATH, 'utf8'));
                        [...vTime, ...pTime].forEach(id => { if(!data[id]) data[id] = { simuV:0, simuP:0, apV:0, apP:0, x1V:0, x1P:0 }; });
                        vTime.forEach(id => data[id].simuV += 1);
                        pTime.forEach(id => data[id].simuP += 1);
                        fs.writeFileSync(PATH, JSON.stringify(data, null, 2));
                    }

                    await b.update({ content: `🏆 Vitória da Dupla: ${vTime.map(id => `<@${id}>`).join(' & ')}`, components: [] });
                    setTimeout(() => th.delete().catch(() => {}), 10000);
                });
            }
        });
    }
};
