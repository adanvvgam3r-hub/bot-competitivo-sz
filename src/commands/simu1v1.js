const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChannelType } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simu1v1')
        .setDescription('Simulador 1v1 com Histórico Completo de Rodadas')
        .addStringOption(o => o.setName('versao').setDescription('Ex: guys, beast ou priv').setRequired(true))
        .addIntegerOption(o => o.setName('vagas').setDescription('Vagas').setRequired(true).addChoices({name:'2 (TESTE)',value:2},{name:'4',value:4},{name:'8',value:8}))
        .addStringOption(o => o.setName('mapa').setDescription('Mapa').setRequired(true))
        .addIntegerOption(o => o.setName('expira').setDescription('Minutos para expirar').setRequired(true)),

    async execute(interaction) {
        const ID_STAFF = '1453126709447754010';
        const ID_CANAL_TOPICOS = '1474560305492394106';
        const RANK_PATH = '/app/data/ranking.json';

        const v = interaction.options.getString('versao');
        const vagas = interaction.options.getInteger('vagas');
        const mapa = interaction.options.getString('mapa').toUpperCase();
        const expira = interaction.options.getInteger('expira');
        let inscritos = [];

        const embedIns = new EmbedBuilder()
            .setTitle(`🏆 SIMULADOR 1V1 - ${mapa}`)
            .setColor('#8b00ff')
            .setDescription(`**Versão:** ${v}\n**Vagas:** ${vagas}`)
            .setFooter({ text: `alpha (0/${vagas})` });

        const rowIns = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('ins').setLabel('INSCREVER').setStyle(ButtonStyle.Primary));
        const res = await interaction.reply({ embeds: [embedIns], components: [rowIns] });

        const col = res.createMessageComponentCollector({ time: expira * 60000 });

        col.on('collect', async i => {
            if (inscritos.includes(i.user.id)) return i.reply({ content: 'Já inscrito!', ephemeral: true });
            inscritos.push(i.user.id);
            if (inscritos.length === vagas) col.stop('lotado');
            else await i.update({ embeds: [new EmbedBuilder(embedIns.data).setFooter({ text: `alpha (${inscritos.length}/${vagas})` })] });
        });

        col.on('end', async (collected, reason) => {
            if (reason === 'lotado') {
                const shuffle = (a) => a.sort(() => Math.random() - 0.5);
                const ids = shuffle([...inscritos]);
                const nomes = ids.map(id => interaction.guild.members.cache.get(id)?.displayName.slice(0,10) || "Player");

                // Estrutura de dados das Rodadas
                let fases = {
                    quartas: [], // Para 8 vagas
                    semis: [],   // Para 4 e 8 vagas
                    final: { p1: "", p2: "", p1id: "", p2id: "", vencId: "", vencNome: "" }
                };

                // Inicializa a primeira fase baseada nas vagas
                if (vagas === 2) {
                    fases.final = { p1: nomes[0], p2: nomes[1], p1id: ids[0], p2id: ids[1], vencId: null };
                } else if (vagas === 4) {
                    fases.semis = [
                        { p1: nomes[0], p2: nomes[1], p1id: ids[0], p2id: ids[1], vencId: null },
                        { p1: nomes[2], p2: nomes[3], p1id: ids[2], p2id: ids[3], vencId: null }
                    ];
                    fases.final = { p1: "Venc 1", p2: "Venc 2", vencId: null };
                } else if (vagas === 8) {
                    for(let i=0; i<8; i+=2) {
                        fases.quartas.push({ p1: nomes[i], p2: nomes[i+1], p1id: ids[i], p2id: ids[i+1], vencId: null });
                    }
                    fases.semis = [{p1: "Venc 1", p2: "Venc 2", vencId: null}, {p1: "Venc 3", p2: "Venc 4", vencId: null}];
                    fases.final = { p1: "Finalista A", p2: "Finalista B", vencId: null };
                }

                const desenhar = () => {
                    let b = "```md\n# ⚔️ BRACKET ALPHA\n\n";
                    const format = (m) => {
                        if (!m.p1id) return `${m.p1} vs ${m.p2}`;
                        if (!m.vencId) return `${m.p1} vs ${m.p2}`;
                        return m.vencId === m.p1id ? `>${m.p1}< vs ${m.p2}` : `${m.p1} vs >${m.p2}<`;
                    };

                    if (vagas === 8) {
                        b += `[QUARTAS]\n${fases.quartas.map((m, i) => `${i+1}. ${format(m)}`).join('\n')}\n\n`;
                        b += `[SEMIS]\n1. ${format(fases.semis[0])}\n2. ${format(fases.semis[1])}\n\n`;
                    } else if (vagas === 4) {
                        b += `[SEMIS]\n1. ${format(fases.semis[0])}\n2. ${format(fases.semis[1])}\n\n`;
                    }
                    
                    b += `[FINAL]\n⭐ ${format(fases.final)}\n`;
                    if (fases.final.vencId) b += `\n🏆 CAMPEÃO: ${fases.final.vencNome}`;
                    return b + "```";
                };

                await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('⚔️ CHAVEAMENTO').setDescription(desenhar()).setColor('#00ff00')], components: [] });

                const canal = interaction.guild.channels.cache.get(ID_CANAL_TOPICOS);

                // Função para criar tópicos e gerenciar vitórias
                const iniciarPartida = async (match, faseNome, index) => {
                    const th = await canal.threads.create({ name: `Simu-${match.p1}-vs-${match.p2}`, type: ChannelType.PrivateThread });
                    await th.members.add(match.p1id); await th.members.add(match.p2id);

                    const rowV = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`v_${match.p1id}`).setLabel(`Vencer: ${match.p1}`).setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId(`v_${match.p2id}`).setLabel(`Vencer: ${match.p2}`).setStyle(ButtonStyle.Success)
                    );

                    const m = await th.send({ content: `⚔️ **CONFRONTO**\n<@${match.p1id}> vs <@${match.p2id}>`, components: [rowV] });
                    const sCol = m.createMessageComponentCollector({ componentType: ComponentType.Button });

                    sCol.on('collect', async b => {
                        if (!b.member.roles.cache.has(ID_STAFF)) return b.reply({ content: 'Apenas Staff!', ephemeral: true });
                        
                        const vId = b.customId.replace('v_', '');
                        const vNome = b.guild.members.cache.get(vId).displayName;

                        // Atualiza os dados da fase atual
                        if (faseNome === 'quartas') fases.quartas[index].vencId = vId;
                        else if (faseNome === 'semis') fases.semis[index].vencId = vId;
                        else if (faseNome === 'final') {
                            fases.final.vencId = vId;
                            fases.final.vencNome = vNome;
                            // Salva Ranking 2026
                            let r = JSON.parse(fs.readFileSync(RANK_PATH, 'utf8'));
                            if(!r[vId]) r[vId] = { simuV: 0, simuP: 0, apV: 0, apP: 0, x1V: 0, x1P: 0 };
                            r[vId].simuV += 1;
                            fs.writeFileSync(RANK_PATH, JSON.stringify(r, null, 2));
                        }

                        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('⚔️ BRACKET ATUALIZADA').setDescription(desenhar()).setColor('#ffff00')] });
                        await b.update({ content: `🏆 Vitória registrada para <@${vId}>!`, components: [] });
                        setTimeout(() => th.delete().catch(() => {}), 10000);
                    });
                };

                // Inicia apenas a primeira fase (Ex: 2 vagas inicia direto na final)
                if (vagas === 2) iniciarPartida(fases.final, 'final', 0);
                else if (vagas === 4) fases.semis.forEach((m, i) => iniciarPartida(m, 'semis', i));
                else if (vagas === 8) fases.quartas.forEach((m, i) => iniciarPartida(m, 'quartas', i));
            }
        });
    }
};
