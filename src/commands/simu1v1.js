const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ComponentType, 
    ChannelType,
    PermissionFlagsBits
} = require('discord.js');
const fs = require('fs');
const path = require('path');

/**
 * 🏆 ALPHA TOURNAMENT ENGINE v4.0
 * ENGINE DE ALTA PERFORMANCE COM BRACKET DINÂMICA E LOGS DE AUDITORIA
 * CONFIGURADO PARA VOLUME RAILWAY: /app/data/
 */

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simu1v1')
        .setDescription('👑 [ALPHA] Simulador Profissional com Bracket Dinâmica e Ranking em Grade')
        .addStringOption(o => o.setName('versao').setDescription('Versão do Jogo (Ex: Guys, Beast, Priv)').setRequired(true))
        .addIntegerOption(o => o.setName('vagas').setDescription('Capacidade de Jogadores').setRequired(true).addChoices(
            { name: '2 Jogadores (Final Direta)', value: 2 },
            { name: '4 Jogadores (Semis & Final)', value: 4 },
            { name: '8 Jogadores (Quartas, Semis & Final)', value: 8 }
        ))
        .addStringOption(o => o.setName('mapa').setDescription('Mapa da Competição').setRequired(true))
        .addIntegerOption(o => o.setName('expira').setDescription('Minutos para encerramento das inscrições').setRequired(true)),

    async execute(interaction) {
        // --- CONSTANTES DE IDENTIDADE E PERMISSÃO ---
        const ID_CARGO_STAFF = '1453126709447754010';
        const ID_CARGO_ADV = '1467222875399393421';
        const ID_CANAL_TOPICOS = '1474560305492394106';
        const ID_CANAL_AUDITORIA = '1473873994674606231';
        
        const PATH_RANKING = '/app/data/ranking.json';
        const PATH_CONFIG = '/app/data/ranking_config.json';
        const ORGANIZADOR_ID = interaction.user.id;

        // --- VALIDAÇÕES DE SEGURANÇA ---
        const isStaff = interaction.member.roles.cache.has(ID_CARGO_STAFF);
        const hasAdv = interaction.member.roles.cache.has(ID_CARGO_ADV);
        const isAdmin = interaction.member.permissions.has(PermissionFlagsBits.Administrator);

        if (hasAdv) {
            return interaction.reply({ content: '⛔ **SISTEMA ALPHA:** Sua conta possui restrições competitivas (Advertência).', ephemeral: true });
        }

        if (!isStaff && !isAdmin) {
            return interaction.reply({ content: '❌ **ACESSO NEGADO:** Comando restrito à Staff da Copa SZ.', ephemeral: true });
        }

        // --- VARIÁVEIS DE ESTADO DA PARTIDA ---
        const versaoInput = interaction.options.getString('versao').toUpperCase();
        const vagasTotais = interaction.options.getInteger('vagas');
        const mapaOficial = interaction.options.getString('mapa').toUpperCase();
        const tempoLimite = interaction.options.getInteger('expira');
        
        let jogadoresInscritos = [];
        let bracketAtiva = true;

        // --- MOTOR DE LOGS DE AUDITORIA ---
        const enviarAuditoria = async (msgEmbed) => {
            const canalLog = interaction.guild.channels.cache.get(ID_CANAL_AUDITORIA);
            if (canalLog) await canalLog.send({ embeds: [msgEmbed] });
        };

        // --- SISTEMA DE PERSISTÊNCIA (FILE SYSTEM) ---
        const lerBancoDados = (caminho) => {
            try {
                if (!fs.existsSync(caminho)) return {};
                const raw = fs.readFileSync(caminho, 'utf8');
                return JSON.parse(raw || '{}');
            } catch (error) {
                console.error(`[ERRO FS] Falha na leitura: ${caminho}`, error);
                return {};
            }
        };

        const gravarBancoDados = (caminho, dados) => {
            try {
                fs.writeFileSync(caminho, JSON.stringify(dados, null, 4));
                return true;
            } catch (error) {
                console.error(`[ERRO FS] Falha na gravação: ${caminho}`, error);
                return false;
            }
        };

        // --- CONSTRUÇÃO DA INTERFACE DE INSCRIÇÃO ---
        const embedStatus = new EmbedBuilder()
            .setTitle(`🏆 SIMULADOR ALPHA 1V1 | ${mapaOficial}`)
            .setAuthor({ name: `Organizado por: ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setColor('#8b00ff')
            .setDescription(`⚠️ **Atenção:** Simulador monitorado. Jogadores com advertência não podem participar.`)
            .addFields(
                { name: '📍 Mapa:', value: `\`${mapaOficial}\``, inline: true },
                { name: '🛠️ Versão:', value: `\`${versaoInput}\``, inline: true },
                { name: '👥 Vagas:', value: `\`${vagasTotais}\``, inline: true }
            )
            .setFooter({ text: `Progresso: (0/${vagasTotais}) • Alpha Competition Engine` })
            .setTimestamp();

        const btnAcao = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('insc_alpha_btn')
                .setLabel('CONFIRMAR INSCRIÇÃO')
                .setEmoji('🎮')
                .setStyle(ButtonStyle.Primary)
        );

        const msgOriginal = await interaction.reply({ embeds: [embedStatus], components: [btnAcao], fetchReply: true });

        const coletorMain = msgOriginal.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: tempoLimite * 60000 
        });

        // --- LÓGICA DE COLETA DE JOGADORES ---
        coletorMain.on('collect', async i => {
            if (i.member.roles.cache.has(ID_CARGO_ADV)) {
                return i.reply({ content: '❌ Seu perfil possui restrições competitivas.', ephemeral: true });
            }

            if (jogadoresInscritos.includes(i.user.id)) {
                return i.reply({ content: '⚠️ Você já está registrado neste simulador.', ephemeral: true });
            }

            if (jogadoresInscritos.length >= vagasTotais) {
                return i.reply({ content: '❌ Todas as vagas foram preenchidas.', ephemeral: true });
            }

            jogadoresInscritos.push(i.user.id);
            
            const embedUpdate = EmbedBuilder.from(embedStatus)
                .setFooter({ text: `Progresso: (${jogadoresInscritos.length}/${vagasTotais}) • Alpha Competition Engine` });

            await i.update({ embeds: [embedUpdate] });

            if (jogadoresInscritos.length === vagasTotais) {
                coletorMain.stop('lotado');
            }
        });

        coletorMain.on('end', async (collected, reason) => {
            if (reason === 'time') {
                const embedCancel = new EmbedBuilder()
                    .setTitle('❌ SIMULADOR EXPIRADO')
                    .setColor('#ff0000')
                    .setDescription(`O tempo de ${tempoLimite} minutos esgotou. Inscrições canceladas.`);
                return interaction.editReply({ embeds: [embedCancel], components: [] });
            }

            if (reason === 'lotado') {
                // --- INICIALIZAÇÃO DA BRACKET ---
                const sortear = (array) => array.sort(() => Math.random() - 0.5);
                const idsSorteados = sortear([...jogadoresInscritos]);
                const nomesP = idsSorteados.map(id => interaction.guild.members.cache.get(id)?.displayName.slice(0,12) || "Player");

                // Estrutura de dados das Rodadas para Histórico Permanente
                let bracketState = {
                    quartas: [],
                    semis: [],
                    final: { p1: "", p2: "", p1id: "", p2id: "", vId: null, vNome: "" }
                };

                // Configuração das Fases
                if (vagasTotais === 2) {
                    bracketState.final = { p1: nomesP[0], p2: nomesP[1], p1id: idsSorteados[0], p2id: idsSorteados[1], vId: null };
                } else if (vagasTotais === 4) {
                    for(let i=0; i<4; i+=2) {
                        bracketState.semis.push({ p1: nomesP[i], p2: nomesP[i+1], p1id: idsSorteados[i], p2id: idsSorteados[i+1], vId: null });
                    }
                    bracketState.final = { p1: "Finalista A", p2: "Finalista B", vId: null };
                } else if (vagasTotais === 8) {
                    for(let i=0; i<8; i+=2) {
                        bracketState.quartas.push({ p1: nomesP[i], p2: nomesP[i+1], p1id: idsSorteados[i], p2id: idsSorteados[i+1], vId: null });
                    }
                    bracketState.semis = [{p1: "Venc 1", p2: "Venc 2", vId: null}, {p1: "Venc 3", p2: "Venc 4", vId: null}];
                    bracketState.final = { p1: "Finalista A", p2: "Finalista B", vId: null };
                }

                // --- GERADOR DE BRACKET VISUAL (ALINHAMENTO EM BLOCO) ---
                const gerarVisualBracket = () => {
                    let text = "```md\n# 🛡️ BRACKET ALPHA OFICIAL\n\n";
                    
                    const formatMatch = (m) => {
                        if (!m.p1id) return `${m.p1.padEnd(12)} vs ${m.p2}`;
                        if (!m.vId) return `${m.p1.padEnd(12)} vs ${m.p2}`;
                        return m.vId === m.p1id ? `>${m.p1}<`.padEnd(14) + ` vs ${m.p2}` : `${m.p1.padEnd(12)} vs >${m.p2}<`;
                    };

                    if (vagasTotais === 8) {
                        text += `[QUARTAS DE FINAL]\n` + bracketState.quartas.map((m, i) => `${i+1}. ${formatMatch(m)}`).join('\n') + "\n\n";
                        text += `[SEMIFINAIS]\n` + bracketState.semis.map((m, i) => `${i === 0 ? 'A' : 'B'}. ${formatMatch(m)}`).join('\n') + "\n\n";
                    } else if (vagasTotais === 4) {
                        text += `[SEMIFINAIS]\n` + bracketState.semis.map((m, i) => `${i+1}. ${formatMatch(m)}`).join('\n') + "\n\n";
                    }
                    
                    text += `[GRANDE FINAL]\n⭐ ${formatMatch(bracketState.final)}\n`;
                    if (bracketState.final.vId) text += `\n🏆 CAMPEÃO: ${bracketState.final.vNome.toUpperCase()}`;
                    return text + "```";
                };

                const embedBracket = new EmbedBuilder()
                    .setTitle('⚔️ CHAVEAMENTO DEFINIDO - ALPHA ENGINE')
                    .setColor('#00ff00')
                    .setDescription(gerarVisualBracket())
                    .setTimestamp();

                await interaction.editReply({ content: '✅ Inscrições encerradas. Iniciando rodadas...', embeds: [embedBracket], components: [] });

                const canalThreads = interaction.guild.channels.cache.get(ID_CANAL_TOPICOS);

                // --- MOTOR DE GERENCIAMENTO DE CONFRONTOS ---
                const criarDueloAlpha = async (confronto, faseNome, index) => {
                    if (!confronto.p1id || !confronto.p2id) return;

                    const thread = await canalThreads.threads.create({
                        name: `AlphaCH-${confronto.p1}-vs-${confronto.p2}`,
                        autoArchiveDuration: 60,
                        type: ChannelType.PrivateThread
                    });

                    await thread.members.add(confronto.p1id);
                    await thread.members.add(confronto.p2id);

                    const btnsDuelo = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`v_${confronto.p1id}`).setLabel(`Vencer: ${confronto.p1}`).setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId(`v_${confronto.p2id}`).setLabel(`Vencer: ${confronto.p2}`).setStyle(ButtonStyle.Success)
                    );

                    const msgDuelo = await thread.send({
                        content: `🏁 **DUELO ALPHA**\nOrganizador: <@${ORGANIZADOR_ID}>\nPartida: <@${confronto.p1id}> vs <@${confronto.p2id}>`,
                        components: [btnsDuelo]
                    });

                    const coletorVitoria = msgDuelo.createMessageComponentCollector();

                    coletorVitoria.on('collect', async b => {
                        // 🔐 TRAVA DE IDENTIDADE: APENAS O ORGANIZADOR PODE CLICAR
                        if (b.user.id !== ORGANIZADOR_ID) {
                            return b.reply({ content: `❌ Bloqueio Alpha: Apenas o organizador <@${ORGANIZADOR_ID}> possui controle sobre esta partida.`, ephemeral: true });
                        }

                        const vId = b.customId.replace('v_', '');
                        const vNome = b.guild.members.cache.get(vId).displayName;

                        // PROMOÇÃO DE RODADAS
                        if (faseNome === 'quartas') {
                            bracketState.quartas[index].vId = vId;
                            const semiIdx = Math.floor(index / 2);
                            const slot = (index % 2 === 0) ? 'p1' : 'p2';
                            bracketState.semis[semiIdx][slot] = vNome;
                            bracketState.semis[semiIdx][slot + 'id'] = vId;
                            // Se a semi estiver pronta, pode disparar (Opcional no fluxo Alpha)
                        } else if (faseNome === 'semis') {
                            bracketState.semis[index].vId = vId;
                            const slot = (index === 0) ? 'p1' : 'p2';
                            bracketState.final[slot] = vNome;
                            bracketState.final[slot + 'id'] = vId;
                        } else if (faseNome === 'final') {
                            bracketState.final.vId = vId;
                            bracketState.final.vNome = vNome;

                            // --- PERSISTÊNCIA DE RANKING E VICE ---
                            let dataR = lerBancoDados(PATH_RANKING);
                            const pId = (vId === confronto.p1id) ? confronto.p2id : confronto.p1id;

                            if (!dataR[vId]) dataR[vId] = { simuV: 0, simuP: 0, apV: 0, apP: 0, x1V: 0, x1P: 0 };
                            if (!dataR[pId]) dataR[pId] = { simuV: 0, simuP: 0, apV: 0, apP: 0, x1V: 0, x1P: 0 };

                            dataR[vId].simuV += 1;
                            dataR[pId].simuP += 1; // Registro de Vice
                            gravarBancoDados(PATH_RANKING, dataR);

                            // --- ATUALIZAÇÃO DA GRADE (PLACAR FIXO) ---
                            try {
                                const confFixo = lerBancoDados(PATH_CONFIG);
                                if (confFixo.channelId) {
                                    const canalRank = await interaction.guild.channels.fetch(confFixo.channelId);
                                    const msgRank = await canalRank.messages.fetch(confFixo.messageId);

                                    const top10 = Object.entries(dataR)
                                        .map(([id, s]) => ({
                                            n: interaction.guild.members.cache.get(id)?.displayName.slice(0, 12) || "Player",
                                            v: s.simuV || 0,
                                            d: s.simuP || 0
                                        }))
                                        .sort((a, b) => b.v - a.v)
                                        .slice(0, 10);

                                    let gradeF = "```md\nPOS  NOME            VITS   VICE\n---  ------------    ----   ----\n";
                                    top10.forEach((u, i) => {
                                        gradeF += `${(i+1).toString().padEnd(3)}  ${u.n.padEnd(14)}  ${u.v.toString().padEnd(5)}  ${u.d}\n`;
                                    });
                                    gradeF += "```";

                                    await msgRank.edit({ embeds: [new EmbedBuilder().setTitle('🏆 RANKING GERAL - ALPHA').setColor('#f1c40f').setDescription(gradeF).setTimestamp()] });
                                }
                            } catch (e) { console.log("Grade fixa não encontrada."); }
                        }

                        // Atualização da Bracket Principal
                        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('⚔️ BRACKET ATUALIZADA').setDescription(gerarVisualBracket()).setColor('#ffff00')] });

                        // Log de Auditoria
                        const embedLog = new EmbedBuilder()
                            .setTitle('🛡️ AUDITORIA ALPHA')
                            .setColor('#3498db')
                            .setDescription(`O organizador <@${ORGANIZADOR_ID}> declarou vitória em uma partida.`)
                            .addFields(
                                { name: 'Vencedor:', value: `<@${vId}>`, inline: true },
                                { name: 'Fase:', value: faseNome, inline: true }
                            );
                        await enviarAuditoria(embedLog);

                        await b.update({ content: `✅ **Vitória registrada.** O tópico será encerrado.`, components: [] });
                        setTimeout(() => thread.delete().catch(() => {}), 10000);
                    });
                };

                // DISPARO DA RODADA INICIAL
                if (vagasTotais === 2) {
                    await criarDueloAlpha(bracketState.final, 'final', 0);
                } else if (vagasTotais === 4) {
                    for(let i=0; i<bracketState.semis.length; i++) {
                        await criarDueloAlpha(bracketState.semis[i], 'semis', i);
                    }
                } else if (vagasTotais === 8) {
                    for(let i=0; i<bracketState.quartas.length; i++) {
                        await criarDueloAlpha(bracketState.quartas[i], 'quartas', i);
                    }
                }
            }
        });
    }
};
