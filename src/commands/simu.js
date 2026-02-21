const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChannelType } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simu')
        .setDescription('Simulador Alpha com Times e Chaveamento')
        .addStringOption(o => o.setName('modo').setDescription('Escolha entre 1v1 ou 2v2').setRequired(true).addChoices({name:'1v1',value:'1v1'},{name:'2v2',value:'2v2'}))
        .addStringOption(o => o.setName('versao').setDescription('Ex: guys, beast ou priv').setRequired(true))
        .addIntegerOption(o => o.setName('vagas').setDescription('Total de JOGADORES (Ex: 4 jogadores = 2 times no 2v2)').setRequired(true).addChoices({name:'2',value:2},{name:'4',value:4},{name:'8',value:8}))
        .addStringOption(o => o.setName('mapa').setDescription('Mapa da partida').setRequired(true))
        .addIntegerOption(o => o.setName('expira').setDescription('Minutos para expirar e cancelar o simu').setRequired(true)),

    async execute(interaction) {
        // IDs DE CONFIGURAÇÃO
        const ID_STAFF = '1453126709447754010';
        const ID_ADV = '1467222875399393421';
        const ID_CANAL_CONFRONTOS = '1474560305492394106';
        const RANK_PATH = '/app/data/ranking.json';
        const criadorId = interaction.user.id;

        // VERIFICAÇÃO DE PERMISSÕES
        if (interaction.member.roles.cache.has(ID_ADV)) return interaction.reply({ content: '❌ Você possui uma **Advertência**!', ephemeral: true });
        if (!interaction.member.roles.cache.has(ID_STAFF) && interaction.user.id !== interaction.guild.ownerId) return interaction.reply({ content: '❌ Apenas Staff!', ephemeral: true });

        const modo = interaction.options.getString('modo');
        const vagas = interaction.options.getInteger('vagas');
        const expiraMin = interaction.options.getInteger('expira');
        const mapa = interaction.options.getString('mapa').toUpperCase();
        const versao = interaction.options.getString('versao').toUpperCase();
        
        let inscritos = [];

        // FUNÇÃO QUE DESENHA A EMBED DE INSCRIÇÃO
        const gerarEmbedInscricao = (cor = '#8b00ff', status = '🟢 INSCRIÇÕES ABERTAS') => {
            let timesTexto = "";
            const porTime = modo === '1v1' ? 1 : 2;
            const totalTimes = vagas / porTime;

            for (let i = 1; i <= totalTimes; i++) {
                const membros = inscritos.slice((i - 1) * porTime, i * porTime);
                let linha = membros.length > 0 ? membros.map(id => `<@${id}>`).join(' | ') : 'ninguem ainda';
                timesTexto += `**Time ${i}:** ${linha}\n`;
            }

            return new EmbedBuilder()
                .setTitle(`🏆 SIMULADOR ${modo} - ${status}`)
                .setColor(cor)
                .setDescription(`**Times:**\n${timesTexto}`)
                .addFields(
                    { name: 'MAPA:', value: mapa, inline: true },
                    { name: 'VERSÃO:', value: versao, inline: true },
                    { name: 'VAGAS:', value: `${vagas}`, inline: true }
                )
                .setFooter({ text: `Progresso: (${inscritos.length}/${vagas}) alpha • Por ${interaction.user.username}` });
        };

        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('in').setLabel('INSCREVER-SE').setStyle(ButtonStyle.Primary));
        const response = await interaction.reply({ embeds: [gerarEmbedInscricao()], components: [row] });

        const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: expiraMin * 60000 });

        collector.on('collect', async i => {
            await i.deferUpdate(); // ⚡ Resposta imediata para evitar "Interação Falhou"

            if (inscritos.includes(i.user.id)) return i.followUp({ content: '❌ Você já está inscrito!', ephemeral: true });
            if (inscritos.length >= vagas) return;

            inscritos.push(i.user.id);
            
            if (inscritos.length === vagas) {
                collector.stop('lotado');
            } else {
                await interaction.editReply({ embeds: [gerarEmbedInscricao()] });
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'lotado') {
                // GERAR BRACKET VISUAL
                const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);
                const p = shuffle([...inscritos]).map(id => interaction.guild.members.cache.get(id)?.displayName.slice(0, 8) || `User_${id.slice(0,3)}`);
                let bData = { p, v: ["Venc A", "Venc B", "Venc C", "Venc D", "Venc E", "Venc F", "CAMPEÃO"] };

                const desenharBracket = (d) => {
                    let b = "```\n";
                    if (vagas === 2 || (modo === '2v2' && vagas === 4)) {
                        b += `${d.p[0]} ─┐\n         ├─ ${d.v[0]}\n${d.p[1]} ─┘\n`;
                    } else if (vagas === 4 || (modo === '2v2' && vagas === 8)) {
                        b += `${d.p[0]} ─┐\n         ├─ ${d.v[0]} ─┐\n${d.p[1]} ─┘         │\n                  ├─ ${d.v[2]}\n${d.p[2]} ─┐         │\n         ├─ ${d.v[1]} ─┘\n${d.p[3]} ─┘\n`;
                    }
                    return b + "```";
                };

                await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`⚔️ BRACKET AO VIVO`).setColor('#00ff00').setDescription(desenharBracket(bData))], components: [] });

                // CRIAR TÓPICOS DE CONFRONTO
                const canalConfrontos = interaction.guild.channels.cache.get(ID_CANAL_CONFRONTOS);
                const saltos = modo === '1v1' ? 2 : 4;

                for (let i = 0; i < inscritos.length; i += saltos) {
                    const idx = i / saltos;
                    const p1Id = inscritos[i];
                    const p2Id = modo === '1v1' ? inscritos[i+1] : inscritos[i+2]; // Pega o líder do Time 2

                    const thread = await canalConfrontos.threads.create({ name: `SimuCH-${Math.floor(1000+Math.random()*9000)}`, type: ChannelType.PrivateThread });
                    
                    // Adiciona todos os jogadores do confronto ao tópico
                    for (let j = i; j < i + saltos; j++) { if(inscritos[j]) await thread.members.add(inscritos[j]); }

                    const rowVenc = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`v_${p1Id}_${idx}`).setLabel(`Vencer Time A`).setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId(`v_${p2Id}_${idx}`).setLabel(`Vencer Time B`).setStyle(ButtonStyle.Success)
                    );

                    const msgThread = await thread.send({ content: `⚔️ **CONFRONTO INICIADO**\nApenas <@${criadorId}> declara o vencedor.`, components: [rowVenc] });
                    const staffCol = msgThread.createMessageComponentCollector({ componentType: ComponentType.Button });

                    staffCol.on('collect', async b => {
                        await b.deferUpdate(); // ⚡ Resposta imediata de 2s

                        if (b.user.id !== criadorId) return b.followUp({ content: `❌ Apenas o criador <@${criadorId}> pode clicar!`, ephemeral: true });
                        
                        setTimeout(async () => {
                            const [ , vencedorId, cIdxStr] = b.customId.split('_');
                            const cIdx = parseInt(cIdxStr);
                            const nomeV = interaction.guild.members.cache.get(vencedorId)?.displayName.slice(0, 8) || "Ganhador";

                            let ehFinal = (vagas === saltos && cIdx === 0) || (vagas === saltos*2 && cIdx === 2);

                            if (ehFinal) {
                                let rData = JSON.parse(fs.readFileSync(RANK_PATH, 'utf8'));
                                // Salva pontos para todos do time vencedor
                                const inicioTime = inscritos.indexOf(vencedorId);
                                for (let k = inicioTime; k < inicioTime + (modo === '1v1' ? 1 : 2); k++) {
                                    const id = inscritos[k];
                                    if (!rData[id]) rData[id] = { simuV: 0, simuP: 0, apV: 0, apP: 0, x1V: 0, x1P: 0 };
                                    rData[id].simuV += 1;
                                }
                                fs.writeFileSync(RANK_PATH, JSON.stringify(rData, null, 2));
                                bData.v[cIdx] = `🏆 ${nomeV}`;
                            } else {
                                bData.v[cIdx] = nomeV;
                            }

                            await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`⚔️ BRACKET ATUALIZADA`).setColor('#ffff00').setDescription(desenharBracket(bData))] });
                            await b.editReply({ content: `🏆 Vitória confirmada!`, components: [] });
                            setTimeout(() => thread.delete().catch(() => {}), 10000);
                        }, 2000);
                    });
                }
            } else if (reason === 'time') {
                await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('❌ EXPIRADO').setColor('#ff0000').setDescription('Simulador cancelado por tempo.')], components: [] });
                setTimeout(() => interaction.deleteReply().catch(() => {}), 30000);
            }
        });
    }
};
