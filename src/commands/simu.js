const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChannelType } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simu')
        .setDescription('Inicia um simulador')
        .addStringOption(o => o.setName('modo').setDescription('1v1/2v2').setRequired(true).addChoices({name:'1v1',value:'1v1'},{name:'2v2',value:'2v2'}))
        .addStringOption(o => o.setName('versao').setDescription('Ex: guys').setRequired(true))
        .addIntegerOption(o => o.setName('vagas').setDescription('Vagas').setRequired(true).addChoices({name:'2 (TESTE)',value:2},{name:'4',value:4},{name:'8',value:8}))
        .addStringOption(o => o.setName('mapa').setDescription('Mapa').setRequired(true))
        .addIntegerOption(o => o.setName('expira').setDescription('Minutos').setRequired(true)),

    async execute(interaction) {
        const ID_STAFF = '1453126709447754010';
        const ID_ADV = '1467222875399393421';
        const ID_CANAL_CONFRONTOS = '1474560305492394106';
        const PATH = '/app/data/ranking.json';

        if (interaction.member.roles.cache.has(ID_ADV)) return interaction.reply({ content: '❌ Advertência ativa!', ephemeral: true });
        if (!interaction.member.roles.cache.has(ID_STAFF)) return interaction.reply({ content: '❌ Apenas Staff!', ephemeral: true });

        const modo = interaction.options.getString('modo');
        const vagas = interaction.options.getInteger('vagas');
        const expiraMin = interaction.options.getInteger('expira');
        let inscritos = [];

        const embed = new EmbedBuilder().setTitle(`🏆 SIMU ${modo}`).setColor('#8b00ff').setFooter({ text: `alpha (0/${vagas})` });
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ins').setLabel('INSCREVER').setStyle(ButtonStyle.Primary));
        const res = await interaction.reply({ embeds: [embed], components: [row] });

        const col = res.createMessageComponentCollector({ time: expiraMin * 60000 });
        col.on('collect', async i => {
            if (inscritos.includes(i.user.id)) return i.reply({ content: 'Já inscrito!', ephemeral: true });
            inscritos.push(i.user.id);
            if (inscritos.length === vagas) col.stop('lotado');
            else await i.update({ embeds: [new EmbedBuilder().setTitle(`🏆 SIMU`).setColor('#8b00ff').setFooter({ text: `alpha (${inscritos.length}/${vagas})` })] });
        });

        col.on('end', async (c, reason) => {
            if (reason === 'lotado') {
                const shuffle = (a) => a.sort(() => Math.random() - 0.5);
                const p = shuffle([...inscritos]).map(id => interaction.guild.members.cache.get(id)?.displayName.slice(0,8) || id.slice(0,4));
                let bracketData = { p, v: ["Venc A", "Venc B", "Venc C", "Venc D", "Venc E", "Venc F", "CAMPEÃO"] };

                const draw = (d) => {
                    let b = "```\n";
                    if (vagas === 2) b += `${d.p[0]} ─┐\n         ├─ ${d.v[0]}\n${d.p[1]} ─┘\n`;
                    else if (vagas === 4) b += `${d.p[0]} ─┐\n         ├─ ${d.v[0]} ─┐\n${d.p[1]} ─┘         │\n                  ├─ ${d.v[2]}\n${d.p[2]} ─┐         │\n         ├─ ${d.v[1]} ─┘\n${d.p[3]} ─┘\n`;
                    return b + "```";
                };

                await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('⚔️ BRACKET').setDescription(draw(bracketData)).setColor('#00ff00')], components: [] });

                const canal = interaction.guild.channels.cache.get(ID_CANAL_CONFRONTOS);
                for (let i = 0; i < inscritos.length; i += 2) {
                    const idx = i/2; const p1 = inscritos[i]; const p2 = inscritos[i+1];
                    const th = await canal.threads.create({ name: `SimuCH-${Math.floor(1000+Math.random()*9000)}`, type: ChannelType.PrivateThread });
                    await th.members.add(p1); await th.members.add(p2);

                    const rowV = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`v_${p1}_${idx}`).setLabel(`Vencer P1`).setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId(`v_${p2}_${idx}`).setLabel(`Vencer P2`).setStyle(ButtonStyle.Success)
                    );

                    const m = await th.send({ content: `⚔️ <@${p1}> vs <@${p2}>`, components: [rowV] });
                    const sCol = m.createMessageComponentCollector();
                    sCol.on('collect', async b => {
                        if (!b.member.roles.cache.has(ID_STAFF)) return b.reply({ content: 'Apenas Staff!', ephemeral: true });
                        const [ , vId, cIdx] = b.customId.split('_');
                        const perdedorId = vId === p1 ? p2 : p1;
                        const finalIdx = (vagas === 2) ? 0 : (vagas === 4) ? 2 : 6;

                        if (parseInt(cIdx) === finalIdx) {
                            const data = JSON.parse(fs.readFileSync(PATH, 'utf8'));
                            if (!data[vId]) data[vId] = { simuV: 0, simuP: 0, apV: 0, apP: 0, x1V: 0, x1P: 0 };
                            if (!data[perdedorId]) data[perdedorId] = { simuV: 0, simuP: 0, apV: 0, apP: 0, x1V: 0, x1P: 0 };
                            data[vId].simuV += 1; data[perdedorId].simuP += 1;
                            fs.writeFileSync(PATH, JSON.stringify(data, null, 2));
                            bracketData.v[finalIdx] = `🏆 ${b.user.username.slice(0,6)}`;
                        } else {
                            bracketData.v[cIdx] = "Vencedor";
                        }

                        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('⚔️ BRACKET').setDescription(draw(bracketData)).setColor('#ffff00')] });
                        await b.update({ content: `🏆 Vitória: <@${vId}>`, components: [] });
                        setTimeout(() => th.delete().catch(() => {}), 10000);
                    });
                }
            } else if (reason === 'time') {
                await interaction.editReply({ content: '❌ Expirado.', embeds: [], components: [] });
                setTimeout(() => interaction.deleteReply().catch(() => {}), 10000);
            }
        });
    }
};
