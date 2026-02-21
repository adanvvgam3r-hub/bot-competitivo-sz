const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChannelType } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simu')
        .setDescription('Simulador Alpha com Bracket Automática')
        .addStringOption(o => o.setName('modo').setDescription('1v1 ou 2v2').setRequired(true).addChoices({name:'1v1',value:'1v1'},{name:'2v2',value:'2v2'}))
        .addStringOption(o => o.setName('versao').setDescription('Ex: guys, beast ou priv').setRequired(true))
        .addIntegerOption(o => o.setName('vagas').setDescription('Quantidade de vagas').setRequired(true).addChoices({name:'2 (TESTE)', value:2},{name:'4',value:4},{name:'8',value:8}))
        .addStringOption(o => o.setName('mapa').setDescription('Mapa da partida').setRequired(true))
        .addIntegerOption(o => o.setName('expira').setDescription('Minutos para expirar').setRequired(true)),

    async execute(interaction) {
        const ID_CARGO_STAFF = '1453126709447754010';
        const ID_CANAL_CONFRONTOS = '1474560305492394106';
        const RANK_PATH = '/app/data/ranking.json';
        const CONF_PATH = '/app/data/ranking_config.json';
        const criadorId = interaction.user.id;

        if (!interaction.member.roles.cache.has(ID_CARGO_STAFF)) return interaction.reply({ content: '❌ Apenas Staff!', ephemeral: true });

        const modo = interaction.options.getString('modo');
        const versao = interaction.options.getString('versao');
        const vagas = interaction.options.getInteger('vagas');
        const mapa = interaction.options.getString('mapa').toUpperCase();
        const expiraMin = interaction.options.getInteger('expira');
        
        let inscritos = [];

        const gerarEmbed = (cor = '#8b00ff', status = '🟢 INSCRIÇÕES ABERTAS') => {
            return new EmbedBuilder()
                .setTitle(`🏆 SIMULADOR ${modo} - ${status}`)
                .setColor(cor)
                .addFields(
                    { name: 'MAPA:', value: mapa, inline: true },
                    { name: 'VERSÃO:', value: versao.toUpperCase(), inline: true },
                    { name: 'VAGAS:', value: `${vagas}`, inline: true },
                    { name: 'INSCRITOS:', value: inscritos.length > 0 ? inscritos.map(id => `<@${id}>`).join(', ') : 'Ninguém ainda', inline: false }
                )
                .setFooter({ text: `Progresso: (${inscritos.length}/${vagas}) alpha • Criador: ${interaction.user.username}` });
        };

        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('inscrever').setLabel('INSCREVER-SE').setStyle(ButtonStyle.Primary));
        const response = await interaction.reply({ embeds: [gerarEmbed()], components: [row] });

        const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: expiraMin * 60000 });

        collector.on('collect', async i => {
            if (inscritos.includes(i.user.id)) return i.reply({ content: 'Já inscrito!', ephemeral: true });
            inscritos.push(i.user.id);
            if (inscritos.length === vagas) collector.stop('lotado');
            else await i.update({ embeds: [gerarEmbed()] });
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'lotado') {
                const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);
                const p = shuffle([...inscritos]).map(id => interaction.guild.members.cache.get(id)?.displayName.slice(0, 8) || `User_${id.slice(0,3)}`);
                let bData = { p, v: ["Venc A", "Venc B", "Venc C", "Venc D", "Venc E", "Venc F", "CAMPEÃO"] };

                const desenharBracket = (data) => {
                    let b = "```\n";
                    if (vagas === 2) b += `${data.p[0]} ─┐\n         ├─ ${data.v[0]}\n${data.p[1]} ─┘\n`;
                    else if (vagas === 4) b += `${data.p[0]} ─┐\n         ├─ ${data.v[0]} ─┐\n${data.p[1]} ─┘         │\n                  ├─ ${data.v[2]}\n${data.p[2]} ─┐         │\n         ├─ ${data.v[1]} ─┘\n${data.p[3]} ─┘\n`;
                    return b + "```";
                };

                await interaction.editReply({ 
                    embeds: [new EmbedBuilder().setTitle(`⚔️ BRACKET AO VIVO`).setColor('#00ff00').setDescription(desenharBracket(bData))], 
                    components: [] 
                });

                const canalConfrontos = interaction.guild.channels.cache.get(ID_CANAL_CONFRONTOS);

                for (let i = 0; i < inscritos.length; i += 2) {
                    const idx = i / 2;
                    const p1Id = inscritos[i];
                    const p2Id = inscritos[i+1];

                    const thread = await canalConfrontos.threads.create({ name: `SimuCH-${Math.floor(1000+Math.random()*9000)}`, type: ChannelType.PrivateThread });
                    await thread.members.add(p1Id); await thread.members.add(p2Id);

                    const rowVenc = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`v_${p1Id}_${idx}`).setLabel(`Vencer P1`).setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId(`v_${p2Id}_${idx}`).setLabel(`Vencer P2`).setStyle(ButtonStyle.Success)
                    );

                    const msg = await thread.send({ content: `⚔️ **CONFRONTO**\n<@${p1Id}> vs <@${p2Id}>\nApenas <@${criadorId}> declara o vencedor.`, components: [rowVenc] });
                    const staffCol = msg.createMessageComponentCollector({ componentType: ComponentType.Button });

                    staffCol.on('collect', async b => {
                        // CORREÇÃO: Responde o clique imediatamente
                        await b.deferUpdate();

                        if (b.user.id !== criadorId) {
                            return b.followUp({ content: `❌ Apenas <@${criadorId}> pode declarar o vencedor!`, ephemeral: true });
                        }
                        
                        const [ , vencedorId, cIdxStr] = b.customId.split('_');
                        const cIdx = parseInt(cIdxStr);
                        const perdedorId = vencedorId === p1Id ? p2Id : p1Id;
                        const nomeVencedor = interaction.guild.members.cache.get(vencedorId)?.displayName.slice(0, 8) || "Ganhador";

                        let ehFinal = (vagas === 2 && cIdx === 0) || (vagas === 4 && cIdx === 2);

                        if (ehFinal) {
                            let rData = JSON.parse(fs.readFileSync(RANK_PATH, 'utf8'));
                            if (!rData[vencedorId]) rData[vencedorId] = { simuV: 0, simuP: 0, apV: 0, apP: 0, x1V: 0, x1P: 0 };
                            if (!rData[perdedorId]) rData[perdedorId] = { simuV: 0, simuP: 0, apV: 0, apP: 0, x1V: 0, x1P: 0 };
                            rData[vencedorId].simuV += 1;
                            rData[perdedorId].simuP += 1;
                            fs.writeFileSync(RANK_PATH, JSON.stringify(rData, null, 2));
                            bData.v[cIdx] = `🏆 ${nomeVencedor}`;

                            // ATUALIZA RANKING FIXO AUTOMATICAMENTE
                            if (fs.existsSync(CONF_PATH)) {
                                try {
                                    const conf = JSON.parse(fs.readFileSync(CONF_PATH, 'utf8'));
                                    const cRank = await interaction.guild.channels.fetch(conf.rankingChannelId);
                                    const mRank = await cRank.messages.fetch(conf.rankingMessageId);
                                    const top10 = Object.entries(rData).sort((a,b) => (b[1].simuV || 0) - (a[1].simuV || 0)).slice(0,10);
                                    const emb = new EmbedBuilder().setTitle('🏆 TOP 10 SIMULADORES').setColor('#f1c40f').setDescription(top10.map((u, i) => `${i+1}º | <@${u[0]}> — **${u[1].simuV} Vitórias**`).join('\n'));
                                    await mRank.edit({ embeds: [emb] });
                                } catch (e) { console.log("Ranking fixo não configurado."); }
                            }
                        } else {
                            bData.v[cIdx] = nomeVencedor;
                        }

                        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`⚔️ BRACKET ATUALIZADA`).setColor('#ffff00').setDescription(desenharBracket(bData))] });
                        await b.editReply({ content: `🏆 Vitória confirmada para: <@${vencedorId}>`, components: [] });
                        setTimeout(() => thread.delete().catch(() => {}), 10000);
                    });
                }
            } else if (reason === 'time') {
                await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('❌ EXPIRADO').setColor('#ff0000').setDescription('Simulador cancelado por tempo.')], components: [] });
                setTimeout(() => interaction.deleteReply().catch(() => {}), 30000);
            }
        });
    }
};
