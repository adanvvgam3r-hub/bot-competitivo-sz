const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ComponentType, 
    ChannelType,
    StringSelectMenuBuilder,
    PermissionFlagsBits
} = require('discord.js');
const fs = require('fs');
const path = require('path');

/**
 * 🏆 SZ TOURNAMENT ENGINE v7.0 - ULTIMATE 2V2
 * SISTEMA DE GRADE DINÂMICA, ESCADA DE SELEÇÃO E CHAVEAMENTO PROGRESSIVO
 * INTEGRADO AO VOLUME RAILWAY: /app/data/
 */

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simu2v2')
        .setDescription('👑 [SZ] Simulador 2v2 de Elite - Grade de Seleção e Rodadas')
        .addStringOption(o => o.setName('versao').setDescription('Versão Técnica').setRequired(true))
        .addIntegerOption(o => o.setName('vagas').setDescription('Total de jogadores').setRequired(true).addChoices(
            { name: '4 Jogadores (2 Duplas)', value: 4 },
            { name: '8 Jogadores (4 Duplas)', value: 8 },
            { name: '12 Jogadores (6 Duplas)', value: 12 },
            { name: '16 Jogadores (8 Duplas)', value: 16 }
        ))
        .addStringOption(o => o.setName('mapa').setDescription('Mapa da Competição').setRequired(true))
        .addIntegerOption(o => o.setName('expira').setDescription('Minutos para inscrições').setRequired(true)),

    async execute(interaction) {
        // =========================================================
        // 🛡️ SEÇÃO 1: INFRAESTRUTURA SZ & SEGURANÇA
        // =========================================================
        const ID_CARGO_STAFF = '1453126709447754010';
        const ID_CARGO_ADV = '1467222875399393421';
        const ID_CANAL_TOPICOS = '1474560305492394106';
        const ID_CANAL_LOGS = '1473873994674606231';
        
        const PATH_RANKING = '/app/data/ranking.json';
        const PATH_CONFIG = '/app/data/ranking_config.json';
        
        // 🔒 TRAVA SUPREMA: APENAS QUEM CRIOU O COMANDO É O "DONO" DA STAFF
        const ORGANIZADOR_RESPONSAVEL = interaction.user.id;

        if (interaction.member.roles.cache.has(ID_CARGO_ADV)) {
            return interaction.reply({ content: '⛔ **RESTRIÇÃO SZ:** Jogadores com advertência não iniciam simuladores.', ephemeral: true });
        }

        if (!interaction.member.roles.cache.has(ID_CARGO_STAFF) && interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ content: '❌ **ACESSO NEGADO:** Requer cargo de Staff SZ.', ephemeral: true });
        }

        // =========================================================
        // 📊 SEÇÃO 2: ESTADO DO SISTEMA & GRADE
        // =========================================================
        const cfgVersao = interaction.options.getString('versao').toUpperCase();
        const cfgVagas = interaction.options.getInteger('vagas');
        const cfgMapa = interaction.options.getString('mapa').toUpperCase();
        const cfgTempo = interaction.options.getInteger('expira');

        let gradeSZ = [];
        for (let i = 0; i < cfgVagas / 2; i++) {
            gradeSZ.push({ 
                id: i + 1, 
                p1id: null, p1n: null, 
                p2id: null, p2n: null, 
                venc: false 
            });
        }

        // --- SISTEMA DE PERSISTÊNCIA SZ ---
        const szRead = (p) => fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {};
        const szWrite = (p, d) => fs.writeFileSync(p, JSON.stringify(d, null, 4));

        const registrarLogSZ = async (txt) => {
            const c = interaction.guild.channels.cache.get(ID_CANAL_LOGS);
            if (c) await c.send(`\`[SZ-LOG]\` ${txt}`);
        };

        // =========================================================
        // 📋 SEÇÃO 3: INTERFACE DE SELEÇÃO (GRADE)
        // =========================================================
        const buildEmbedGrade = (status = '🟢 SELEÇÃO DE DUPLAS SZ', cor = '#0099ff') => {
            const emb = new EmbedBuilder()
                .setTitle(`🏆 SIMULADOR SZ 2V2 | ${status}`)
                .setColor(cor)
                .setDescription(`🗺️ **MAPA:** \`${cfgMapa}\` | 🎮 **VERSÃO:** \`${cfgVersao}\``)
                .setThumbnail(interaction.guild.iconURL());

            gradeSZ.forEach(d => {
                const j1 = d.p1id ? `<@${d.p1id}>` : '*Slot Vazio*';
                const j2 = d.p2id ? `<@${d.p2id}>` : '*Slot Vazio*';
                emb.addFields({ 
                    name: `👥 DUPLA ${d.id}`, 
                    value: `**A:** ${j1}\n**B:** ${j2}`, 
                    inline: true 
                });
            });

            emb.setFooter({ text: `SZ Engine • Organizador: ${interaction.user.username}` });
            return emb;
        };

        const buildMenuEscada = () => {
            const menu = new StringSelectMenuBuilder()
                .setCustomId('sz_menu_dupla')
                .setPlaceholder('[ ESCOLHA SEU TIME SZ > ]');

            gradeSZ.forEach(d => {
                menu.addOptions({
                    label: `Dupla ${d.id}`,
                    description: `Entrar nos slots da Dupla ${d.id}`,
                    value: `sz_d_${d.id - 1}`
                });
            });
            return new ActionRowBuilder().addComponents(menu);
        };

        const msgLobby = await interaction.reply({ 
            embeds: [buildEmbedGrade()], 
            components: [buildMenuEscada()], 
            fetchReply: true 
        });

        const coletorLobby = msgLobby.createMessageComponentCollector({ time: cfgTempo * 60000 });

        // =========================================================
        // 🕹️ SEÇÃO 4: MOTOR DE INSCRIÇÃO EM GRADE
        // =========================================================
        coletorLobby.on('collect', async i => {
            const todosNoSimu = gradeSZ.flatMap(d => [d.p1id, d.p2id]);

            if (i.isStringSelectMenu()) {
                if (todosNoSimu.includes(i.user.id)) return i.reply({ content: '❌ Você já está na grade!', ephemeral: true });

                const dIdx = parseInt(i.values[0].split('_')[2]);
                const rowSlots = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`sz_slot_${dIdx}_p1id`)
                        .setLabel(`Slot A (Dupla ${dIdx + 1})`)
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(!!gradeSZ[dIdx].p1id),
                    new ButtonBuilder()
                        .setCustomId(`sz_slot_${dIdx}_p2id`)
                        .setLabel(`Slot B (Dupla ${dIdx + 1})`)
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(!!gradeSZ[dIdx].p2id)
                );

                return i.reply({ content: `Selecione seu slot na **Dupla ${dIdx + 1}**:`, components: [rowSlots], ephemeral: true });
            }

            if (i.isButton()) {
                const [, , dIdx, campo] = i.customId.split('_');
                const idx = parseInt(dIdx);

                if (gradeSZ[idx][campo]) return i.reply({ content: '❌ Slot ocupado!', ephemeral: true });

                gradeSZ[idx][campo] = i.user.id;
                gradeSZ[idx][campo.replace('id', 'n')] = i.user.username.slice(0,8);

                const totalInscritos = gradeSZ.flatMap(d => [d.p1id, d.p2id]).filter(v => v !== null).length;

                await i.update({ content: `✅ Slot garantido na **Dupla ${idx + 1}**!`, components: [] });
                
                if (totalInscritos === cfgVagas) coletorLobby.stop('lotado');
                else await interaction.editReply({ embeds: [buildEmbedGrade()] });
            }
        });

        coletorLobby.on('end', async (collected, reason) => {
            if (reason !== 'lotado') return interaction.editReply({ content: '❌ Simu cancelado por tempo.', embeds: [], components: [] });

            // =========================================================
            // 🏗️ SEÇÃO 5: CHAVEAMENTO SZ (SEMIS & FINAIS)
            // =========================================================
            let bracketSZ = {
                oitavas: [], quartas: [], semis: [], 
                final: { d1: null, d2: null, venc: null }
            };

            // Setup por Vagas
            if (cfgVagas === 4) {
                bracketSZ.final = { d1: gradeSZ[0], d2: gradeSZ[1], venc: null };
            } else {
                for(let i=0; i<gradeSZ.length; i+=2) bracketSZ.semis.push({ d1: gradeSZ[i], d2: gradeSZ[i+1], venc: null });
                bracketSZ.final = { d1: {nome: "Venc A"}, d2: {nome: "Venc B"}, venc: null };
            }

            const renderBracketFinal = () => {
                let text = "```md\n# 🛡️ BRACKET SZ 2V2 OFICIAL\n\n";
                const format = (m) => {
                    const n1 = m.d1.nome || `${m.d1.p1n}+${m.d1.p2n}`;
                    const n2 = m.d2.nome || `${m.d2.p1n}+${m.d2.p2n}`;
                    if (!m.venc) return `${n1.padEnd(15)} vs ${n2}`;
                    return m.venc === n1 ? `>${n1}<`.padEnd(17) + ` vs ${n2}` : `${n1.padEnd(15)} vs >${n2}<`;
                };

                if (cfgVagas >= 8) text += `[SEMIFINAIS]\n` + bracketSZ.semis.map((m, i) => `${i+1}. ${format(m)}`).join('\n') + "\n\n";
                text += `[GRANDE FINAL]\n⭐ ${format(bracketSZ.final)}\n`;
                if (bracketSZ.final.venc) text += `\n🏆 CAMPEÕES SZ: ${bracketSZ.final.venc.toUpperCase()}`;
                return text + "```";
            };

            await interaction.editReply({ 
                content: '🏁 **GradeSZ Completa!** Tópicos de duelo sendo criados...',
                embeds: [new EmbedBuilder().setTitle('⚔️ CHAVEAMENTO DEFINIDO SZ').setDescription(renderBracketFinal()).setColor('#00ff00')], 
                components: [] 
            });

            // =========================================================
            // 🥊 SEÇÃO 6: MOTOR DE DUELO 2V2 & VITÓRIA DUPLA
            // =========================================================
            const dispararConfronto2v2 = async (partida, fase, idx) => {
                const thread = await interaction.guild.channels.cache.get(ID_CANAL_TOPICOS).threads.create({
                    name: `SZ2v2-D${partida.d1.id || 'A'}-vs-D${partida.d2.id || 'B'}`,
                    type: ChannelType.PrivateThread
                });

                [partida.d1.p1id, partida.d1.p2id, partida.d2.p1id, partida.d2.p2id].forEach(id => { if(id) thread.members.add(id); });

                const nomeD1 = partida.d1.nome || `${partida.d1.p1n}+${partida.d1.p2n}`;
                const nomeD2 = partida.d2.nome || `${partida.d2.p1n}+${partida.d2.p2n}`;

                const rowWin = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('w1').setLabel(`Vencer: ${nomeD1}`).setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('w2').setLabel(`Vencer: ${nomeD2}`).setStyle(ButtonStyle.Danger)
                );

                const msgT = await thread.send({
                    content: `🏆 <@${ORGANIZADOR_RESPONSAVEL}>, valide o resultado desta rodada SZ:\n**${nomeD1}** vs **${nomeD2}**`,
                    components: [rowWin]
                });

                const coletorVit = msgT.createMessageComponentCollector();
                coletorVit.on('collect', async b => {
                    // 🔒 TRAVA DE ORGANIZADOR: SÓ O CRIADOR DECIDE
                    if (b.user.id !== ORGANIZADOR_RESPONSAVEL) {
                        return b.reply({ content: `❌ **BLOQUEIO SZ:** Apenas <@${ORGANIZADOR_RESPONSAVEL}> (Criador) pode validar este resultado.`, ephemeral: true });
                    }

                    const winD = b.customId === 'w1' ? partida.d1 : partida.d2;
                    const loseD = b.customId === 'w1' ? partida.d2 : partida.d1;
                    const nomeW = b.customId === 'w1' ? nomeD1 : nomeD2;

                    if (fase === 'semis') {
                        bracketSZ.semis[idx].venc = nomeW;
                        const slot = idx === 0 ? 'd1' : 'd2';
                        bracketSZ.final[slot] = { nome: nomeW, p1id: winD.p1id, p2id: winD.p2id, p1n: winD.p1n, p2n: winD.p2n };
                    } else {
                        bracketSZ.final.venc = nomeW;
                        
                        // 💾 SALVAMENTO NO RANKING SZ (DUPLO)
                        let r = szRead(PATH_RANKING);
                        [winD.p1id, winD.p2id].forEach(id => {
                            if (!r[id]) r[id] = { simuV: 0, simuP: 0, apV: 0, apP: 0, x1V: 0, x1P: 0 };
                            r[id].simuV += 1;
                        });
                        [loseD.p1id, loseD.p2id].forEach(id => {
                            if (!r[id]) r[id] = { simuV: 0, simuP: 0, apV: 0, apP: 0, x1V: 0, x1P: 0 };
                            r[id].simuP += 1;
                        });
                        szWrite(PATH_RANKING, r);

                        // 📢 ATUALIZAÇÃO DA GRADE FIXA SZ
                        try {
                            const cF = szRead(PATH_CONFIG);
                            const canalR = await interaction.guild.channels.fetch(cF.channelId);
                            const msgR = await canalR.messages.fetch(cF.messageId);
                            const top10 = Object.entries(r).sort((a,b) => b[1].simuV - a[1].simuV).slice(0,10);
                            
                            let gradeStr = "```md\nPOS  NOME            VITS   VICE\n---  ------------    ----   ----\n";
                            top10.forEach((u, i) => {
                                const nU = interaction.guild.members.cache.get(u[0])?.displayName.slice(0,12) || "Player";
                                gradeStr += `${(i+1).toString().padEnd(3)}  ${nU.padEnd(14)}  ${u[1].simuV.toString().padEnd(5)}  ${u[1].simuP}\n`;
                            });
                            await msgR.edit({ embeds: [new EmbedBuilder().setTitle('🏆 RANKING GERAL SZ').setColor('#f1c40f').setDescription(gradeStr + "```")] });
                        } catch (err) {}
                    }

                    await interaction.editReply({ 
                        embeds: [new EmbedBuilder().setTitle('⚔️ ATUALIZAÇÃO BRACKET SZ').setDescription(renderBracketFinal()).setColor('#ffff00')] 
                    });

                    await b.update({ content: `✅ Resultado Processado. Tópico será deletado.`, components: [], embeds: [] });
                    await registrarLogSZ(`Vitória 2v2: ${nomeW} por ${interaction.user.tag}`);
                    setTimeout(() => thread.delete().catch(() => {}), 15000);
                });
            };

            // DISPARO INICIAL SZ
            if (cfgVagas === 4) await dispararConfronto2v2(bracketSZ.final, 'final', 0);
            else {
                for(let i=0; i<bracketSZ.semis.length; i++) await dispararConfronto2v2(bracketSZ.semis[i], 'semis', i);
            }
        });
    }
};
