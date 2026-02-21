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
 * 🏆 ALPHA 2V2 TOURNAMENT ENGINE v5.0
 * SISTEMA AVANÇADO DE GRADE, SELEÇÃO E CHAVEAMENTO POR RODADAS
 * PERSISTÊNCIA EM VOLUME RAILWAY: /app/data/
 */

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simu2v2')
        .setDescription('👑 [ALPHA] Simulador 2v2 Profissional com Grade de Seleção e Rodadas')
        .addStringOption(o => o.setName('versao').setDescription('Versão (Ex: Guys, Beast, Priv)').setRequired(true))
        .addIntegerOption(o => o.setName('vagas').setDescription('Total de jogadores').setRequired(true).addChoices(
            { name: '4 Jogadores (2 Duplas - Final Direta)', value: 4 },
            { name: '8 Jogadores (4 Duplas - Semis & Final)', value: 8 },
            { name: '12 Jogadores (6 Duplas - Rodadas)', value: 12 }
        ))
        .addStringOption(o => o.setName('mapa').setDescription('Mapa da Competição').setRequired(true))
        .addIntegerOption(o => o.setName('expira').setDescription('Minutos para inscrições').setRequired(true)),

    async execute(interaction) {
        // --- CONSTANTES DE ACESSO ---
        const ID_STAFF = '1453126709447754010';
        const ID_ADV = '1467222875399393421';
        const ID_CANAL_TOPICOS = '1474560305492394106';
        const ID_CANAL_AUDITORIA = '1473873994674606231';
        
        const PATH_RANKING = '/app/data/ranking.json';
        const PATH_CONFIG = '/app/data/ranking_config.json';
        const ORGANIZADOR_ID = interaction.user.id;

        // --- VALIDAÇÕES ALPHA ---
        if (interaction.member.roles.cache.has(ID_ADV)) {
            return interaction.reply({ content: '⛔ **SISTEMA ALPHA:** Jogadores com advertência não podem gerenciar torneios.', ephemeral: true });
        }

        if (!interaction.member.roles.cache.has(ID_STAFF) && interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ content: '❌ **ACESSO NEGADO:** Exclusivo para Staff autorizada.', ephemeral: true });
        }

        const versaoInput = interaction.options.getString('versao').toUpperCase();
        const vagasTotais = interaction.options.getInteger('vagas');
        const mapaOficial = interaction.options.getString('mapa').toUpperCase();
        const tempoLimite = interaction.options.getInteger('expira');

        // --- INICIALIZAÇÃO DA GRADE DE DUPLAS ---
        let gradeDuplas = [];
        for (let i = 0; i < vagasTotais / 2; i++) {
            gradeDuplas.push({ 
                id: i + 1, 
                p1id: null, p1nome: null, 
                p2id: null, p2nome: null, 
                vencedora: false 
            });
        }

        // --- SISTEMA DE LOGS ---
        const registrarAuditoria = async (desc, cor = '#3498db') => {
            const canal = interaction.guild.channels.cache.get(ID_CANAL_AUDITORIA);
            if (canal) {
                const log = new EmbedBuilder().setTitle('🛡️ LOG 2V2 ALPHA').setDescription(desc).setColor(cor).setTimestamp();
                await canal.send({ embeds: [log] });
            }
        };

        // --- GESTÃO DE ARQUIVOS (VOLUME) ---
        const lerDados = (p) => {
            try { return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : {}; }
            catch (e) { return {}; }
        };

        const gravarDados = (p, d) => {
            try { fs.writeFileSync(p, JSON.stringify(d, null, 4)); return true; }
            catch (e) { return false; }
        };

        // --- INTERFACE VISUAL DA GRADE ---
        const construirGradeEmbed = (cor = '#0099ff', status = '🟢 SELEÇÃO DE TIMES') => {
            const embed = new EmbedBuilder()
                .setTitle(`🏆 SIMULADOR 2V2 | ${status}`)
                .setColor(cor)
                .setDescription(`📊 **MAPA:** \`${mapaOficial}\` | **VERSÃO:** \`${versaoInput}\``)
                .setThumbnail(interaction.guild.iconURL());

            gradeDuplas.forEach(d => {
                const j1 = d.p1id ? `<@${d.p1id}>` : '` Vazio `';
                const j2 = d.p2id ? `<@${d.p2id}>` : '` Vazio `';
                embed.addFields({ 
                    name: `👥 DUPLA ${d.id}`, 
                    value: `Slot A: ${j1}\nSlot B: ${j2}`, 
                    inline: true 
                });
            });

            embed.setFooter({ text: `Organizador: ${interaction.user.username} • alpha engine` });
            return embed;
        };

        // --- ESCADA DE SELEÇÃO (MENU) ---
        const menuSelecao = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('menu_dupla')
                .setPlaceholder('[ ESCOLHA SEU TIME > ]')
                .addOptions(gradeDuplas.map(d => ({
                    label: `Entrar na Dupla ${d.id}`,
                    value: `dupla_${d.id - 1}`,
                    description: `Vagas disponíveis para o Time ${d.id}`
                })))
        );

        const msgPrincipal = await interaction.reply({ 
            embeds: [construirGradeEmbed()], 
            components: [menuSelecao], 
            fetchReply: true 
        });

        const coletorSelecao = msgPrincipal.createMessageComponentCollector({ 
            time: tempoLimite * 60000 
        });

        // --- LÓGICA DE PREENCHIMENTO DA GRADE ---
        coletorSelecao.on('collect', async i => {
            const todosInscritos = gradeDuplas.flatMap(d => [d.p1id, d.p2id]);
            
            if (i.isStringSelectMenu()) {
                if (todosInscritos.includes(i.user.id)) {
                    return i.reply({ content: '⚠️ Você já ocupa um slot nesta grade.', ephemeral: true });
                }

                const dIdx = parseInt(i.values[0].split('_')[1]);
                const btnsSlots = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`slot_${dIdx}_p1id`)
                        .setLabel(`Entrar Slot A (D${dIdx + 1})`)
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(!!gradeDuplas[dIdx].p1id),
                    new ButtonBuilder()
                        .setCustomId(`slot_${dIdx}_p2id`)
                        .setLabel(`Entrar Slot B (D${dIdx + 1})`)
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(!!gradeDuplas[dIdx].p2id)
                );

                return i.reply({ 
                    content: `Você selecionou a **Dupla ${dIdx + 1}**. Escolha seu slot:`, 
                    components: [btnsSlots], 
                    ephemeral: true 
                });
            }

            if (i.isButton()) {
                const [, dIdx, campo] = i.customId.split('_');
                const index = parseInt(dIdx);

                if (gradeDuplas[index][campo]) {
                    return i.reply({ content: '❌ Slot preenchido por outro jogador.', ephemeral: true });
                }

                gradeDuplas[index][campo] = i.user.id;
                gradeDuplas[index][campo.replace('id', 'nome')] = i.user.username.slice(0,8);

                const total = gradeDuplas.flatMap(d => [d.p1id, d.p2id]).filter(v => v !== null).length;

                await i.update({ content: `✅ Você entrou na **Dupla ${index + 1}**!`, components: [] });
                
                if (total === vagasTotais) {
                    coletorSelecao.stop('lotado');
                } else {
                    await interaction.editReply({ embeds: [construirGradeEmbed()] });
                }
            }
        });

        coletorSelecao.on('end', async (collected, reason) => {
            if (reason === 'lotado') {
                // --- INICIALIZAÇÃO DA BRACKET DE RODADAS ---
                let bracket2v2 = {
                    semis: [],
                    final: { d1: null, d2: null, vNome: null }
                };

                if (vagasTotais === 4) {
                    bracket2v2.final = { d1: gradeDuplas[0], d2: gradeDuplas[1], vNome: null };
                } else {
                    // Mapeia Semis para 8 jogadores
                    for(let i=0; i<gradeDuplas.length; i+=2) {
                        bracket2v2.semis.push({ d1: gradeDuplas[i], d2: gradeDuplas[i+1], vNome: null });
                    }
                    bracket2v2.final = { d1: {nome: "Vencedor A"}, d2: {nome: "Vencedor B"}, vNome: null };
                }

                const gerarMarkdownBracket = () => {
                    let md = "```md\n# ⚔️ BRACKET 2V2 OFICIAL\n\n";
                    const f = (m) => {
                        const n1 = m.d1.nome || `${m.d1.p1nome}+${m.d1.p2nome}`;
                        const n2 = m.d2.nome || `${m.d2.p1nome}+${m.d2.p2nome}`;
                        if (!m.vNome) return `${n1.padEnd(15)} vs ${n2}`;
                        return m.vNome === n1 ? `>${n1}<`.padEnd(17) + ` vs ${n2}` : `${n1.padEnd(15)} vs >${n2}<`;
                    };

                    if (vagasTotais === 8) {
                        md += `[SEMIFINAIS]\n1. ${f(bracket2v2.semis[0])}\n2. ${f(bracket2v2.semis[1])}\n\n`;
                    }
                    md += `[GRANDE FINAL]\n⭐ ${f(bracket2v2.final)}\n`;
                    if (bracket2v2.final.vNome) md += `\n🏆 CAMPEÕES: ${bracket2v2.final.vNome.toUpperCase()}`;
                    return md + "```";
                };

                await interaction.editReply({ 
                    content: '🏁 **Grade Fechada!** Gerando confrontos...', 
                    embeds: [new EmbedBuilder().setTitle('⚔️ CHAVEAMENTO ALPHA 2V2').setDescription(gerarMarkdownBracket()).setColor('#00ff00')], 
                    components: [] 
                });

                const canalThreads = interaction.guild.channels.cache.get(ID_CANAL_TOPICOS);

                // --- MOTOR DE CONFRONTOS 2V2 ---
                const dispararDuelo2v2 = async (match, fase, idx) => {
                    const thread = await canalThreads.threads.create({
                        name: `2v2-${match.d1.id || 'A'}-vs-${match.d2.id || 'B'}`,
                        type: ChannelType.PrivateThread
                    });

                    [match.d1.p1id, match.d1.p2id, match.d2.p1id, match.d2.p2id].forEach(id => {
                        if (id) thread.members.add(id);
                    });

                    const n1 = match.d1.nome || `${match.d1.p1nome}+${match.d1.p2nome}`;
                    const n2 = match.d2.nome || `${match.d2.p1nome}+${match.d2.p2nome}`;

                    const rowV = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('v1').setLabel(`Vencer: ${n1}`).setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('v2').setLabel(`Vencer: ${n2}`).setStyle(ButtonStyle.Danger)
                    );

                    const msgT = await thread.send({
                        content: `🏆 <@${ORGANIZADOR_ID}>, declare o resultado:\n**${n1}** vs **${n2}**`,
                        components: [rowV]
                    });

                    const sCol = msgT.createMessageComponentCollector();
                    sCol.on('collect', async b => {
                        if (b.user.id !== ORGANIZADOR_ID) {
                            return b.reply({ content: `❌ Bloqueio Organizador: Apenas <@${ORGANIZADOR_ID}> pode validar o resultado.`, ephemeral: true });
                        }

                        const winDupla = b.customId === 'v1' ? match.d1 : match.d2;
                        const loseDupla = b.customId === 'v1' ? match.d2 : match.d1;
                        const winNome = b.customId === 'v1' ? n1 : n2;

                        if (fase === 'semis') {
                            bracket2v2.semis[idx].vNome = winNome;
                            // Avança para a final (simples)
                            const finalPos = idx === 0 ? 'd1' : 'd2';
                            bracket2v2.final[finalPos] = { nome: winNome, p1id: winDupla.p1id, p2id: winDupla.p2id, p1nome: winDupla.p1nome, p2nome: winDupla.p2nome };
                        } else {
                            bracket2v2.final.vNome = winNome;
                            // --- ATUALIZAÇÃO RANKING DUPLO ---
                            let rank = lerDados(PATH_RANKING);
                            [winDupla.p1id, winDupla.p2id].forEach(id => {
                                if (!rank[id]) rank[id] = { simuV: 0, simuP: 0, apV: 0, apP: 0, x1V: 0, x1P: 0 };
                                rank[id].simuV += 1;
                            });
                            [loseDupla.p1id, loseDupla.p2id].forEach(id => {
                                if (!rank[id]) rank[id] = { simuV: 0, simuP: 0, apV: 0, apP: 0, x1V: 0, x1P: 0 };
                                rank[id].simuP += 1; // VICE
                            });
                            gravarDados(PATH_RANKING, rank);

                            // --- ATUALIZAÇÃO GRADE FIXA ---
                            try {
                                const conf = lerDados(PATH_CONFIG);
                                const canalR = await interaction.guild.channels.fetch(conf.channelId);
                                const msgR = await canalR.messages.fetch(conf.messageId);
                                const top10 = Object.entries(rank).sort((a,b) => b[1].simuV - a[1].simuV).slice(0,10);
                                
                                let tabela = "```md\nPOS  NOME            VITS   VICE\n---  ------------    ----   ----\n";
                                top10.forEach((u, i) => {
                                    const nomeU = interaction.guild.members.cache.get(u[0])?.displayName.slice(0,12) || "Player";
                                    tabela += `${(i+1).toString().padEnd(3)}  ${nomeU.padEnd(14)}  ${u[1].simuV.toString().padEnd(5)}  ${u[1].simuP}\n`;
                                });
                                await msgR.edit({ embeds: [new EmbedBuilder().setTitle('🏆 RANKING GERAL - ALPHA').setColor('#f1c40f').setDescription(tabela + "```")] });
                            } catch (err) {}
                        }

                        await interaction.editReply({ 
                            embeds: [new EmbedBuilder().setTitle('⚔️ BRACKET 2V2 ATUALIZADA').setDescription(gerarMarkdownBracket()).setColor('#ffff00')] 
                        });

                        await b.update({ content: `✅ Resultado processado. Vitória da Dupla: **${winNome}**`, components: [], embeds: [] });
                        await registrarAuditoria(`Vencedores 2v2: ${winNome} declarado por ${interaction.user.tag}`);
                        setTimeout(() => thread.delete().catch(() => {}), 15000);
                    });
                };

                // DISPARO INICIAL
                if (vagasTotais === 4) {
                    await dispararDuelo2v2(bracket2v2.final, 'final', 0);
                } else {
                    for(let i=0; i<bracket2v2.semis.length; i++) {
                        await dispararDuelo2v2(bracket2v2.semis[i], 'semis', i);
                    }
                }
            } else if (reason === 'time') {
                await interaction.editReply({ content: '❌ Inscrições expiradas.', embeds: [], components: [] });
            }
        });
    }
};
