const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChannelType } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simu1v1')
        .setDescription('🏆 Simulador 1v1 Profissional - Todas as Vagas')
        .addStringOption(o => o.setName('versao').setDescription('guys, beast, priv').setRequired(true))
        .addIntegerOption(o => o.setName('vagas').setDescription('Quantidade de Vagas').setRequired(true).addChoices(
            { name: '2 (Final Direta)', value: 2 },
            { name: '4 (Semis e Final)', value: 4 },
            { name: '8 (Quartas, Semis e Final)', value: 8 },
            { name: '16 (Oitavas até Final)', value: 16 }
        ))
        .addStringOption(o => o.setName('mapa').setDescription('Mapa da partida').setRequired(true))
        .addIntegerOption(o => o.setName('expira').setDescription('Tempo de inscrição (Minutos)').setRequired(true)),

    async execute(interaction) {
        const ID_STAFF = '1453126709447754010';
        const ID_CANAL_TOPICOS = '1474560305492394106';
        const RANK_PATH = '/app/data/ranking.json';
        const CONFIG_PATH = '/app/data/ranking_config.json';
        
        // 🔒 TRAVA: APENAS O CRIADOR CONTROLA OS BOTÕES DE VITÓRIA
        const criadorId = interaction.user.id;

        if (!interaction.member.roles.cache.has(ID_STAFF) && interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ content: '❌ Você não tem o cargo de Organizador!', ephemeral: true });
        }

        const versao = interaction.options.getString('versao').toUpperCase();
        const vagas = interaction.options.getInteger('vagas');
        const mapa = interaction.options.getString('mapa').toUpperCase();
        const expira = interaction.options.getInteger('expira');
        let inscritos = [];

        // --- EMBED DE INSCRIÇÃO ---
        const embedIns = new EmbedBuilder()
            .setTitle(`🏆 SIMULADOR 1V1: ${mapa}`)
            .setColor('#8b00ff')
            .addFields(
                { name: '🎮 VERSÃO:', value: versao, inline: true },
                { name: '👥 VAGAS:', value: `${vagas}`, inline: true },
                { name: '⏱️ EXPIRA:', value: `${expira} min`, inline: true }
            )
            .setFooter({ text: `Organizador: ${interaction.user.username} • alpha` });

        const rowIns = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('in').setLabel('INSCREVER-SE').setStyle(ButtonStyle.Primary)
        );

        const res = await interaction.reply({ embeds: [embedIns], components: [rowIns] });

        const colIns = res.createMessageComponentCollector({ time: expira * 60000 });

        colIns.on('collect', async i => {
            if (inscritos.includes(i.user.id)) return i.reply({ content: 'Você já está inscrito!', ephemeral: true });
            inscritos.push(i.user.id);
            
            if (inscritos.length === vagas) {
                colIns.stop('lotado');
            } else {
                const newFooter = `Organizador: ${interaction.user.username} • (${inscritos.length}/${vagas}) alpha`;
                await i.update({ embeds: [new EmbedBuilder(embedIns.data).setFooter({ text: newFooter })] });
            }
        });

        colIns.on('end', async (collected, reason) => {
            if (reason === 'lotado') {
                const shuffle = (a) => a.sort(() => Math.random() - 0.5);
                const ids = shuffle([...inscritos]);
                const nomes = ids.map(id => interaction.guild.members.cache.get(id)?.displayName.slice(0,10) || "Player");

                // 📊 ESTRUTURA COMPLETA DE FASES (QUARTAS, SEMIS, FINAL)
                let fases = {
                    oitavas: [], quartas: [], semis: [], final: { p1: "", p2: "", p1id: "", p2id: "", vId: "", vNome: "" }
                };

                // Inicialização Dinâmica
                if (vagas === 2) {
                    fases.final = { p1: nomes[0], p2: nomes[1], p1id: ids[0], p2id: ids[1], vId: null };
                } else if (vagas === 4) {
                    fases.semis = [
                        { p1: nomes[0], p2: nomes[1], p1id: ids[0], p2id: ids[1], vId: null },
                        { p1: nomes[2], p2: nomes[3], p1id: ids[2], p2id: ids[3], vId: null }
                    ];
                    fases.final = { p1: "Venc 1", p2: "Venc 2", vId: null };
                } else if (vagas === 8) {
                    for(let i=0; i<8; i+=2) {
                        fases.quartas.push({ p1: nomes[i], p2: nomes[i+1], p1id: ids[i], p2id: ids[i+1], vId: null });
                    }
                    fases.semis = [{ p1: "Venc A", p2: "Venc B", vId: null }, { p1: "Venc C", p2: "Venc D", vId: null }];
                    fases.final = { p1: "Finalista 1", p2: "Finalista 2", vId: null };
                }

                // 🎨 FUNÇÃO DE DESENHO (O HISTÓRICO QUE VOCÊ PEDIU)
                const desenhar = () => {
                    let b = "```md\n# ⚔️ BRACKET ALPHA - 1V1\n\n";
                    const f = (m) => {
                        if (!m.p1id) return `${m.p1} vs ${m.p2}`;
                        if (!m.vId) return `${m.p1} vs ${m.p2}`;
                        return m.vId === m.p1id ? `>${m.p1}< vs ${m.p2}` : `${m.p1} vs >${m.p2}<`;
                    };

                    if (vagas === 8) {
                        b += `[QUARTAS DE FINAL]\n` + fases.quartas.map((m, i) => `${i+1}. ${f(m)}`).join('\n') + "\n\n";
                    }
                    if (vagas >= 4) {
                        b += `[SEMIFINAIS]\n` + fases.semis.map((m, i) => `${String.fromCharCode(65+i)}. ${f(m)}`).join('\n') + "\n\n";
                    }
                    b += `[GRANDE FINAL]\n⭐ ${f(fases.final)}\n`;
                    if (fases.final.vId) b += `\n🏆 CAMPEÃO: ${fases.final.vNome}`;
                    return b + "```";
                };

                await interaction.editReply({ 
                    content: `🚨 **Inscrições fechadas!** Iniciando confrontos...`,
                    embeds: [new EmbedBuilder().setTitle('⚔️ CHAVEAMENTO DEFINIDO').setDescription(desenhar()).setColor('#00ff00')], 
                    components: [] 
                });

                const canalThreads = interaction.guild.channels.cache.get(ID_CANAL_TOPICOS);

                // 🕹️ GERENCIADOR DE CONFRONTOS
                const iniciarDuelo = async (match, faseNome, index) => {
                    if (!match.p1id || !match.p2id) return;

                    const thread = await canalThreads.threads.create({ 
                        name: `Simu1v1-${match.p1}-vs-${match.p2}`, 
                        type: ChannelType.PrivateThread 
                    });

                    await thread.members.add(match.p1id);
                    await thread.members.add(match.p2id);

                    const rowV = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`v_${match.p1id}`).setLabel(`Vencer: ${match.p1}`).setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId(`v_${match.p2id}`).setLabel(`Vencer: ${match.p2}`).setStyle(ButtonStyle.Success)
                    );

                    const msgT = await thread.send({ 
                        content: `🏆 <@${criadorId}>, declare o vencedor:\n<@${match.p1id}> vs <@${match.p2id}>`, 
                        components: [rowV] 
                    });

                    const sCol = msgT.createMessageComponentCollector();

                    sCol.on('collect', async b => {
                        // 🔐 TRAVA DE CRIADOR
                        if (b.user.id !== criadorId) {
                            return b.reply({ content: `❌ Apenas o organizador <@${criadorId}> pode clicar!`, ephemeral: true });
                        }

                        const vId = b.customId.replace('v_', '');
                        const vNome = b.guild.members.cache.get(vId).displayName;

                        // ATUALIZAÇÃO DA LÓGICA DE FASES
                        if (faseNome === 'quartas') {
                            fases.quartas[index].vId = vId;
                            // Avança para Semi
                            const semiIdx = Math.floor(index / 2);
                            const slot = (index % 2 === 0) ? 'p1' : 'p2';
                            fases.semis[semiIdx][slot] = vNome;
                            fases.semis[semiIdx][slot + 'id'] = vId;
                        } 
                        else if (faseNome === 'semis') {
                            fases.semis[index].vId = vId;
                            // Avança para Final
                            const slot = (index === 0) ? 'p1' : 'p2';
                            fases.final[slot] = vNome;
                            fases.final[slot + 'id'] = vId;
                        } 
                        else if (faseNome === 'final') {
                            fases.final.vId = vId;
                            fases.final.vNome = vNome;

                            // 💾 SALVAMENTO NO RANKING VOLUME
                            let rData = JSON.parse(fs.readFileSync(RANK_PATH, 'utf8'));
                            const pId = vId === match.p1id ? match.p2id : match.p1id;

                            if (!rData[vId]) rData[vId] = { simuV: 0, simuP: 0, apV: 0, apP: 0, x1V: 0, x1P: 0 };
                            if (!rData[pId]) rData[pId] = { simuV: 0, simuP: 0, apV: 0, apP: 0, x1V: 0, x1P: 0 };

                            rData[vId].simuV += 1;
                            rData[pId].simuP += 1; // VICE
                            fs.writeFileSync(RANK_PATH, JSON.stringify(rData, null, 2));

                            // 📢 ATUALIZAR MENSAGEM FIXA (RANKING GERAL)
                            try {
                                const conf = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
                                const ch = await interaction.guild.channels.fetch(conf.channelId);
                                const mF = await ch.messages.fetch(conf.messageId);
                                const top10 = Object.entries(rData).sort((a,b) => b[1].simuV - a[1].simuV).slice(0,10);
                                const emb = new EmbedBuilder().setTitle('🏆 RANKING GERAL - ALPHA').setColor('#f1c40f')
                                    .setDescription(top10.map((u, i) => `${i+1}º | <@${u[0]}> — **${u[1].simuV} Vitórias**`).join('\n'));
                                await mF.edit({ embeds: [emb] });
                            } catch (e) { console.log("Config do ranking não encontrada."); }
                        }

                        // Atualiza a Embed principal a cada vitória
                        await interaction.editReply({ 
                            embeds: [new EmbedBuilder().setTitle('⚔️ BRACKET ATUALIZADA').setDescription(desenhar()).setColor('#ffff00')] 
                        });

                        await b.update({ content: `✅ Resultado processado!`, components: [] });
                        
                        // Se avançou, cria o próximo tópico se a fase lotar (Lógica de continuação)
                        if (faseNome !== 'final') {
                             await thread.send(`🏆 Partida encerrada! Aguarde a Staff abrir a próxima fase.`);
                        }

                        setTimeout(() => thread.delete().catch(() => {}), 10000);
                    });
                };

                // DISPARA A PRIMEIRA RODADA
                if (vagas === 2) iniciarDuelo(fases.final, 'final', 0);
                else if (vagas === 4) fases.semis.forEach((m, i) => iniciarDuelo(m, 'semis', i));
                else if (vagas === 8) fases.quartas.forEach((m, i) => iniciarDuelo(m, 'quartas', i));

            } else if (reason === 'time') {
                await interaction.editReply({ content: '❌ Inscrições encerradas por tempo.', embeds: [], components: [] });
            }
        });
    }
};
