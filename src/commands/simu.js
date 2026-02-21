const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChannelType } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simu')
        .setDescription('Simulador Alpha')
        .addStringOption(o => o.setName('modo').setDescription('1v1/2v2').setRequired(true).addChoices({name:'1v1',value:'1v1'},{name:'2v2',value:'2v2'}))
        .addStringOption(o => o.setName('versao').setDescription('guys, beast...').setRequired(true))
        .addIntegerOption(o => o.setName('vagas').setDescription('Vagas').setRequired(true).addChoices({name:'2',value:2},{name:'4',value:4},{name:'8',value:8}))
        .addStringOption(o => o.setName('mapa').setDescription('Mapa').setRequired(true))
        .addIntegerOption(o => o.setName('expira').setDescription('Minutos').setRequired(true)),

    async execute(interaction) {
        const ID_STAFF = '1453126709447754010';
        const ID_CANAL_TOPICOS = '1474560305492394106';
        const RANK_PATH = '/app/data/ranking.json';
        const CONF_PATH = '/app/data/ranking_config.json';
        const criadorId = interaction.user.id;

        if (!interaction.member.roles.cache.has(ID_STAFF)) return interaction.reply({ content: '❌ Apenas Staff!', ephemeral: true });

        const vagas = interaction.options.getInteger('vagas');
        const modo = interaction.options.getString('modo');
        let inscritos = [];

        const embedInsc = new EmbedBuilder().setTitle(`🏆 SIMU ${modo}`).setColor('#8b00ff').setFooter({text: `alpha (0/${vagas})`});
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('in').setLabel('INSCREVER').setStyle(ButtonStyle.Primary));
        const res = await interaction.reply({ embeds: [embedInsc], components: [row] });

        const col = res.createMessageComponentCollector({ time: interaction.options.getInteger('expira') * 60000 });
        col.on('collect', async i => {
            if (inscritos.includes(i.user.id)) return i.reply({ content: 'Já inscrito!', ephemeral: true });
            inscritos.push(i.user.id);
            if (inscritos.length === vagas) col.stop('lotado');
            else await i.update({ embeds: [new EmbedBuilder().setTitle(`🏆 SIMU`).setColor('#8b00ff').setFooter({text: `alpha (${inscritos.length}/${vagas})`})] });
        });

        col.on('end', async (c, reason) => {
            if (reason === 'lotado') {
                const shuffle = (a) => a.sort(() => Math.random() - 0.5);
                const p = shuffle([...inscritos]).map(id => interaction.guild.members.cache.get(id)?.displayName.slice(0,8) || id.slice(0,4));
                let bData = { p, v: ["Venc A", "Venc B", "Venc C", "Venc D", "Venc E", "Venc F", "CAMPEÃO"] };

                const draw = (d) => {
                    let txt = "```\n";
                    if (vagas === 2) txt += `${d.p[0]} ─┐\n         ├─ ${d.v[0]}\n${d.p[1]} ─┘\n`;
                    else if (vagas === 4) txt += `${d.p[0]} ─┐\n         ├─ ${d.v[0]} ─┐\n${d.p[1]} ─┘         │\n                  ├─ ${d.v[2]}\n${d.p[2]} ─┐         │\n         ├─ ${d.v[1]} ─┘\n${d.p[3]} ─┘\n`;
                    return txt + "```";
                };

                await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('⚔️ BRACKET').setDescription(draw(bData)).setColor('#00ff00')], components: [] });

                const canal = interaction.guild.channels.cache.get(ID_CANAL_TOPICOS);
                for (let i = 0; i < inscritos.length; i += 2) {
                    const idx = i/2; const p1 = inscritos[i]; const p2 = inscritos[i+1];
                    const th = await canal.threads.create({ name: `SimuCH-${Math.floor(1000+Math.random()*9000)}`, type: ChannelType.PrivateThread });
                    await th.members.add(p1); await th.members.add(p2);

                    const rowV = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`v_${p1}_${idx}`).setLabel(`Vencer P1`).setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId(`v_${p2}_${idx}`).setLabel(`Vencer P2`).setStyle(ButtonStyle.Success)
                    );

                    const m = await th.send({ content: `⚔️ <@${p1}> vs <@${p2}>\nApenas <@${criadorId}> declara o vencedor.`, components: [rowV] });
                    const sCol = m.createMessageComponentCollector();

                    sCol.on('collect', async b => {
                        if (b.user.id !== criadorId) return b.reply({ content: 'Apenas o criador!', ephemeral: true });
                        const [ , vId, cIdxStr] = b.customId.split('_');
                        const cIdx = parseInt(cIdxStr);
                        const perdedorId = vId === p1 ? p2 : p1;

                        let ehFinal = (vagas === 2 && cIdx === 0) || (vagas === 4 && cIdx === 2);
                        if (ehFinal) {
                            const data = JSON.parse(fs.readFileSync(RANK_PATH, 'utf8'));
                            if (!data[vId]) data[vId] = { simuV: 0, simuP: 0, apV: 0, apP: 0, x1V: 0, x1P: 0 };
                            if (!data[perdedorId]) data[perdedorId] = { simuV: 0, simuP: 0, apV: 0, apP: 0, x1V: 0, x1P: 0 };
                            data[vId].simuV += 1; data[perdedorId].simuP += 1;
                            fs.writeFileSync(RANK_PATH, JSON.stringify(data, null, 2));
                            bData.v[cIdx] = `🏆 ${b.user.username.slice(0,6)}`;

                            // ATUALIZA RANKING FIXO
                            if (fs.existsSync(CONF_PATH)) {
                                const conf = JSON.parse(fs.readFileSync(CONF_PATH, 'utf8'));
                                const cRank = await interaction.guild.channels.fetch(conf.rankingChannelId);
                                const mRank = await cRank.messages.fetch(conf.rankingMessageId);
                                const top10 = Object.entries(data).sort((a,b) => b[1].simuV - a[1].simuV).slice(0,10);
                                const emb = new EmbedBuilder().setTitle('🏆 RANKING TOP 10').setColor('#f1c40f').setDescription(top10.map((u, i) => `${i+1}º | <@${u[0]}> — **${u[1].simuV} Vitórias**`).join('\n'));
                                await mRank.edit({ embeds: [emb] });
                            }
                        } else {
                            bData.v[cIdx] = "Ganhador";
                        }

                        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('⚔️ BRACKET ATUALIZADA').setDescription(draw(bData)).setColor('#ffff00')] });
                        await b.update({ content: `🏆 Vitória: <@${vId}>`, components: [] });
                        setTimeout(() => th.delete().catch(() => {}), 10000);
                    });
                }
            }
        });
    }
};
