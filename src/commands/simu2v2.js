const { 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ComponentType, 
    ChannelType,
    PermissionFlagsBits,
    AttachmentBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');

/**
 * 🏆 SZ COMPETITIVE ENGINE v6.0 - ULTIMATE EDITION
 * SISTEMA DE GESTÃO DE TORNEIOS DE ALTA DISPONIBILIDADE
 * FOCO: SEGURANÇA, PERSISTÊNCIA E PERFORMANCE NO RAILWAY
 */

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simu1v1')
        .setDescription('👑 [SZ] O Motor de Simuladores mais avançado do servidor.')
        .addStringOption(o => o.setName('versao').setDescription('Versão técnica do simulador').setRequired(true))
        .addIntegerOption(o => o.setName('vagas').setDescription('Vagas disponíveis').setRequired(true).addChoices(
            { name: '2 Jogadores (Duelo Único)', value: 2 },
            { name: '4 Jogadores (Chaveamento Curto)', value: 4 },
            { name: '8 Jogadores (Torneio Completo)', value: 8 }
        ))
        .addStringOption(o => o.setName('mapa').setDescription('Mapa mandatório').setRequired(true))
        .addIntegerOption(o => o.setName('expira').setDescription('Tempo limite (minutos)').setRequired(true)),

    async execute(interaction) {
        // =========================================================
        // 🛡️ SEÇÃO 1: DEFINIÇÕES DE AMBIENTE E SEGURANÇA
        // =========================================================
        const ID_CARGO_STAFF = '1453126709447754010';
        const ID_CARGO_ADV = '1467222875399393421';
        const ID_CANAL_TOPICOS = '1474560305492394106';
        const ID_CANAL_AUDITORIA = '1473873994674606231';
        
        const PATH_RANKING = '/app/data/ranking.json';
        const PATH_CONFIG = '/app/data/ranking_config.json';
        const ORGANIZADOR_ID = interaction.user.id;

        // Flags de Validação
        const isStaffAutorizada = interaction.member.roles.cache.has(ID_CARGO_STAFF);
        const isUsuarioComRestricao = interaction.member.roles.cache.has(ID_CARGO_ADV);
        const isServerOwner = interaction.user.id === interaction.guild.ownerId;

        // Resposta de Segurança Imediata
        if (isUsuarioComRestricao) {
            return interaction.reply({ content: '⛔ **SISTEMA SZ:** Operação abortada. Sua conta possui restrições disciplinares.', ephemeral: true });
        }

        if (!isStaffAutorizada && !isServerOwner) {
            return interaction.reply({ content: '❌ **ERRO DE PERMISSÃO:** Comando restrito à hierarquia Staff SZ.', ephemeral: true });
        }

        // =========================================================
        // 📊 SEÇÃO 2: COLETA E SANITIZAÇÃO DE DADOS
        // =========================================================
        const cfgVersao = interaction.options.getString('versao').toUpperCase();
        const cfgVagas = interaction.options.getInteger('vagas');
        const cfgMapa = interaction.options.getString('mapa').toUpperCase();
        const cfgTempo = interaction.options.getInteger('expira');
        
        let poolJogadores = [];
        let engineStatus = "INICIALIZANDO";

        // =========================================================
        // ⚙️ SEÇÃO 3: FUNÇÕES DE MOTOR INTERNO (CORE)
        // =========================================================
        
        const coreLogger = async (mensagem, gravidade = 'INFO') => {
            const canalLogs = interaction.guild.channels.cache.get(ID_CANAL_AUDITORIA);
            if (!canalLogs) return console.log(`[SZ-LOG] ${mensagem}`);
            
            const logEmbed = new EmbedBuilder()
                .setTitle(`🛠️ AUDITORIA SZ - ${gravidade}`)
                .setDescription(`\`\`\`fix\n${mensagem}\n\`\`\``)
                .setColor(gravidade === 'ALERTA' ? '#ff0000' : '#3498db')
                .setTimestamp();
            
            await canalLogs.send({ embeds: [logEmbed] });
        };

        const coreFileRead = (caminho) => {
            try {
                if (!fs.existsSync(caminho)) return {};
                const data = fs.readFileSync(caminho, 'utf8');
                return JSON.parse(data || '{}');
            } catch (err) {
                coreLogger(`Erro crítico de leitura: ${err.message}`, 'ALERTA');
                return {};
            }
        };

        const coreFileWrite = (caminho, conteudo) => {
            try {
                fs.writeFileSync(caminho, JSON.stringify(conteudo, null, 4));
                return true;
            } catch (err) {
                coreLogger(`Erro crítico de gravação: ${err.message}`, 'ALERTA');
                return false;
            }
        };

        // =========================================================
        // 📋 SEÇÃO 4: LÓGICA DE INSCRIÇÃO E GESTÃO DE FILA
        // =========================================================
        
        const lobbyEmbed = new EmbedBuilder()
            .setTitle(`🏆 SIMULADOR SZ COMPETITIVO | ${cfgMapa}`)
            .setAuthor({ name: `ORGANIZADOR: ${interaction.user.tag}`, iconURL: interaction.user.displayAvatarURL() })
            .setColor('#8b00ff')
            .setDescription(`**Este evento está sendo gravado e monitorado.**\nInscrições abertas para jogadores verificados.`)
            .addFields(
                { name: '🔹 Mapa:', value: `\`${cfgMapa}\``, inline: true },
                { name: '🔹 Versão:', value: `\`${cfgVersao}\``, inline: true },
                { name: '🔹 Vagas:', value: `\`${cfgVagas}\``, inline: true }
            )
            .setFooter({ text: `SZ Engine • Sistema de Alta Disponibilidade • alpha` })
            .setTimestamp();

        const lobbyRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('btn_sz_join')
                .setLabel('CONFIRMAR ENTRADA')
                .setEmoji('🥊')
                .setStyle(ButtonStyle.Primary)
        );

        const responseOriginal = await interaction.reply({ 
            embeds: [lobbyEmbed], 
            components: [lobbyRow], 
            fetchReply: true 
        });

        const collectorInscricoes = responseOriginal.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: cfgTempo * 60000 
        });

        collectorInscricoes.on('collect', async i => {
            if (i.member.roles.cache.has(ID_CARGO_ADV)) {
                return i.reply({ content: '❌ Bloqueio de Segurança: Você não tem permissão para competir.', ephemeral: true });
            }

            if (poolJogadores.includes(i.user.id)) {
                return i.reply({ content: '⚠️ Você já está registrado neste evento.', ephemeral: true });
            }

            if (poolJogadores.length >= cfgVagas) {
                return i.reply({ content: '❌ Vagas preenchidas.', ephemeral: true });
            }

            poolJogadores.push(i.user.id);
            
            const updateEmbed = EmbedBuilder.from(lobbyEmbed)
                .setFooter({ text: `Progresso: (${poolJogadores.length}/${cfgVagas}) • SZ Engine • alpha` });

            await i.update({ embeds: [updateEmbed] });

            if (poolJogadores.length === cfgVagas) {
                collectorInscricoes.stop('lotado');
            }
        });

        collectorInscricoes.on('end', async (collected, reason) => {
            if (reason === 'time') {
                const cancelEmbed = new EmbedBuilder()
                    .setTitle('❌ EVENTO EXPIRADO')
                    .setColor('#ff0000')
                    .setDescription('O tempo limite de inscrição foi atingido sem preenchimento das vagas.');
                return interaction.editReply({ embeds: [cancelEmbed], components: [] });
            }

            if (reason === 'lotado') {
                // =========================================================
                // 🏗️ SEÇÃO 5: GERAÇÃO DA BRACKET E CHAVEAMENTO
                // =========================================================
                engineStatus = "PROCESSANDO_CHAVES";
                await coreLogger(`Simulador ${cfgMapa} lotado. Iniciando motor de chaveamento.`);

                const shuffle = (array) => array.sort(() => Math.random() - 0.5);
                const idsFinalizados = shuffle([...poolJogadores]);
                const nomesFinalizados = idsFinalizados.map(id => interaction.guild.members.cache.get(id)?.displayName.slice(0, 10) || "SZ_PLAYER");

                let dataBracket = {
                    quartas: [],
                    semis: [],
                    final: { p1: "", p2: "", p1id: "", p2id: "", vId: null, vNome: "" }
                };

                // Inicialização da Estrutura de Dados das Rodadas
                if (cfgVagas === 2) {
                    dataBracket.final = { p1: nomesFinalizados, p2: nomesFinalizados, p1id: idsFinalizados, p2id: idsFinalizados, vId: null };
                } else if (cfgVagas === 4) {
                    for(let i=0; i<4; i+=2) {
                        dataBracket.semis.push({ p1: nomesFinalizados[i], p2: nomesFinalizados[i+1], p1id: idsFinalizados[i], p2id: idsFinalizados[i+1], vId: null });
                    }
                    dataBracket.final = { p1: "Finalista A", p2: "Finalista B", vId: null };
                } else if (cfgVagas === 8) {
                    for(let i=0; i<8; i+=2) {
                        dataBracket.quartas.push({ p1: nomesFinalizados[i], p2: nomesFinalizados[i+1], p1id: idsFinalizados[i], p2id: idsFinalizados[i+1], vId: null });
                    }
                    dataBracket.semis = [{ p1: "Vencedor 1", p2: "Vencedor 2", vId: null }, { p1: "Vencedor 3", p2: "Vencedor 4", vId: null }];
                    dataBracket.final = { p1: "Finalista A", p2: "Finalista B", vId: null };
                }

                const renderVisual = () => {
                    let b = "```md\n# 🛡️ BRACKET SZ OFICIAL - 1V1\n\n";
                    const formatarPartida = (m) => {
                        if (!m.p1id || !m.vId) return `${m.p1.padEnd(12)} vs ${m.p2}`;
                        return m.vId === m.p1id ? `>${m.p1}<`.padEnd(14) + ` vs ${m.p2}` : `${m.p1.padEnd(12)} vs >${m.p2}<`;
                    };

                    if (cfgVagas === 8) {
                        b += `[QUARTAS DE FINAL]\n` + dataBracket.quartas.map((m, i) => `${i+1}. ${formatarPartida(m)}`).join('\n') + "\n\n";
                    }
                    if (cfgVagas >= 4) {
                        b += `[SEMIFINAIS]\n` + dataBracket.semis.map((m, i) => `${i === 0 ? 'A' : 'B'}. ${formatarPartida(m)}`).join('\n') + "\n\n";
                    }
                    b += `[GRANDE FINAL]\n⭐ ${formatarPartida(dataBracket.final)}\n`;
                    if (dataBracket.final.vId) b += `\n🏆 CAMPEÃO SZ: ${dataBracket.final.vNome.toUpperCase()}`;
                    return b + "```";
                };

                const embedBracket = new EmbedBuilder()
                    .setTitle('⚔️ CHAVEAMENTO DEFINIDO | SZ ENGINE')
                    .setColor('#00ff00')
                    .setDescription(renderVisual())
                    .setTimestamp();

                await interaction.editReply({ 
                    content: '🚀 **Inscrições finalizadas.** Verifique seus tópicos privados.',
                    embeds: [embedBracket], 
                    components: [] 
                });

                const canalAlvo = interaction.guild.channels.cache.get(ID_CANAL_TOPICOS);

                // =========================================================
                // 🥊 SEÇÃO 6: MOTOR DE DUELO E GESTÃO DE VITÓRIAS
                // =========================================================
                
                const executorDuelo = async (confronto, faseNome, index) => {
                    if (!confronto.p1id || !confronto.p2id) return;

                    const thread = await canalAlvo.threads.create({
                        name: `SZ1v1-${confronto.p1}-vs-${confronto.p2}`,
                        autoArchiveDuration: 60,
                        type: ChannelType.PrivateThread,
                        reason: 'Competição SZ 1v1'
                    });

                    await thread.members.add(confronto.p1id);
                    await thread.members.add(confronto.p2id);

                    const btsVitoria = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`win_${confronto.p1id}`).setLabel(`Vencer: ${confronto.p1}`).setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId(`win_${confronto.p2id}`).setLabel(`Vencer: ${confronto.p2}`).setStyle(ButtonStyle.Success)
                    );

                    const msgDuelo = await thread.send({
                        content: `🏁 **ESTÁGIO DE DUELO SZ**\nOrganizador: <@${ORGANIZADOR_ID}>\nPartida: <@${confronto.p1id}> vs <@${confronto.p2id}>\nMapa: ${cfgMapa}`,
                        components: [btsVitoria]
                    });

                    const coletorVitoria = msgDuelo.createMessageComponentCollector();

                    coletorVitoria.on('collect', async b => {
                        // 🔒 TRAVA DE ORGANIZADOR: SÓ O CRIADOR PODE VALIDAR
                        if (b.user.id !== ORGANIZADOR_ID) {
                            return b.reply({ 
                                content: `❌ **BLOQUEIO SZ:** Apenas o organizador <@${ORGANIZADOR_ID}> tem autoridade sobre este resultado.`, 
                                ephemeral: true 
                            });
                        }

                        const winId = b.customId.replace('win_', '');
                        const winNome = b.guild.members.cache.get(winId).displayName;

                        // 📈 LÓGICA DE PROGRESSÃO DE BRACKET
                        if (faseNome === 'quartas') {
                            dataBracket.quartas[index].vId = winId;
                            const sIdx = Math.floor(index / 2);
                            const slot = (index % 2 === 0) ? 'p1' : 'p2';
                            dataBracket.semis[sIdx][slot] = winNome;
                            dataBracket.semis[sIdx][slot + 'id'] = winId;
                        } 
                        else if (faseNome === 'semis') {
                            dataBracket.semis[index].vId = winId;
                            const slot = (index === 0) ? 'p1' : 'p2';
                            dataBracket.final[slot] = winNome;
                            dataBracket.final[slot + 'id'] = winId;
                        } 
                        else if (faseNome === 'final') {
                            dataBracket.final.vId = winId;
                            dataBracket.final.vNome = winNome;

                            // 💾 GRAVAÇÃO NO RANKING PERMANENTE
                            let dbRanking = coreFileRead(PATH_RANKING);
                            const loseId = (winId === confronto.p1id) ? confronto.p2id : confronto.p1id;

                            if (!dbRanking[winId]) dbRanking[winId] = { simuV: 0, simuP: 0, apV: 0, apP: 0, x1V: 0, x1P: 0 };
                            if (!dbRanking[loseId]) dbRanking[loseId] = { simuV: 0, simuP: 0, apV: 0, apP: 0, x1V: 0, x1P: 0 };

                            dbRanking[winId].simuV += 1;
                            dbRanking[loseId].simuP += 1; // Registro de Vice-Campeão
                            coreFileWrite(PATH_RANKING, dbRanking);

                            // 📢 ATUALIZAÇÃO DA GRADE VISUAL FIXA
                            try {
                                const configFixo = coreFileRead(PATH_CONFIG);
                                if (configFixo.channelId) {
                                    const canalRank = await interaction.guild.channels.fetch(configFixo.channelId);
                                    const msgRank = await canalRank.messages.fetch(configFixo.messageId);

                                    const top10 = Object.entries(dbRanking)
                                        .map(([id, s]) => ({
                                            nome: interaction.guild.members.cache.get(id)?.displayName.slice(0, 12) || "Player",
                                            v: s.simuV || 0,
                                            d: s.simuP || 0
                                        }))
                                        .sort((a, b) => b.v - a.v)
                                        .slice(0, 10);

                                    let gradeSZ = "```md\nPOS  NOME            VITS   VICE\n---  ------------    ----   ----\n";
                                    top10.forEach((u, idx) => {
                                        const p = (idx + 1).toString().padEnd(3, ' ');
                                        const n = u.nome.padEnd(14, ' ');
                                        const v = u.v.toString().padEnd(5, ' ');
                                        gradeSZ += `${p}  ${n}  ${v}  ${u.d}\n`;
                                    });
                                    gradeSZ += "```";

                                    await msgRank.edit({ 
                                        embeds: [new EmbedBuilder().setTitle('🏆 RANKING GERAL SZ').setColor('#f1c40f').setDescription(gradeSZ).setTimestamp()] 
                                    });
                                }
                            } catch (e) {
                                console.log("Grade fixa não localizada para edição automática.");
                            }
                        }

                        // Edição da Bracket em tempo real na mensagem principal
                        await interaction.editReply({ 
                            embeds: [new EmbedBuilder().setTitle('⚔️ ATUALIZAÇÃO DE BRACKET | SZ').setDescription(renderVisual()).setColor('#ffff00')] 
                        });

                        await coreLogger(`Partida validada por ${interaction.user.tag}: ${winNome} avançou na fase ${faseNome}.`);

                        await b.update({ content: `✅ **RESULTADO PROCESSADO.** Vitória de <@${winId}> confirmada.`, components: [] });
                        
                        setTimeout(() => thread.delete().catch(() => {}), 15000);
                    });
                };

                // DISPARO DAS RODADAS INICIAIS
                if (cfgVagas === 2) {
                    await executorDuelo(dataBracket.final, 'final', 0);
                } else if (cfgVagas === 4) {
                    for(let i=0; i<dataBracket.semis.length; i++) {
                        await executorDuelo(dataBracket.semis[i], 'semis', i);
                    }
                } else if (cfgVagas === 8) {
                    for(let i=0; i<bracketState.quartas.length; i++) {
                        await executorDuelo(dataBracket.quartas[i], 'quartas', i);
                    }
                }
            }
        });
    }
};
