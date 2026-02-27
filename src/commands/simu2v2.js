const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simu2v2')
        .setDescription('Simulador 2v2 com chaves automáticas')
        .addStringOption(o => o.setName('versao').setDescription('Versão').setRequired(true))
        .addIntegerOption(o => o.setName('vagas').setDescription('Total de jogadores').setRequired(true)
            .addChoices({name:'4 (2 Times)',value:4},{name:'8 (4 Times)',value:8},{name:'16 (8 Times)',value:16}))
        .addStringOption(o => o.setName('mapa').setDescription('Mapa').setRequired(true))
        .addIntegerOption(o => o.setName('expira').setDescription('Minutos').setRequired(true)),

    async execute(interaction) {
        const ID_STAFF = '1453126709447754010';
        const CANAL_PERMITIDO = '1465842384586670254';
        const ID_CONFRONTOS = '1474560305492394106';
        const PATH = '/app/data/ranking.json';
        const CONFIG_PATH = '/app/data/ranking_config.json';
        const ORGANIZADOR_ID = interaction.user.id;

        if (interaction.channel.id !== CANAL_PERMITIDO) return interaction.reply({ content: `❌ Use <@#${CANAL_PERMITIDO}>`, ephemeral: true });
        if (!interaction.member.roles.cache.has(ID_STAFF)) return interaction.reply({ content: '❌ Sem permissão!', ephemeral: true });

        const vagas = interaction.options.getInteger('vagas');
        const versao = interaction.options.getString('versao').toUpperCase();
        const mapa = interaction.options.getString('mapa').toUpperCase();
        const expiraMin = interaction.options.getInteger('expira');
        let slots = Array(vagas).fill(null);

        const gerarEmbed = (encerrado = false) => {
            const lista = slots.map((user, i) => {
                const tNum = Math.floor(i / 2) + 1;
                const sNum = (i % 2) + 1;
                return `**TIME ${tNum}** (Vaga ${sNum}): ${user ? `<@${user}>` : '----'}`;
            }).join('\n');
            const desc = encerrado ? '✅ **INSCRIÇÕES ENCERRADAS - SIMULADOR INICIADO**' : `Expira em <t:${Math.floor((Date.now() + expiraMin * 60000) / 1000)}:R>`;
            return new EmbedBuilder()
                .setTitle('🏆 SIMULADOR 2V2 - SELEÇÃO DE TIMES')
                .setColor(encerrado ? '#00ff00' : '#2ecc71')
                .setDescription(`${desc}\n\n**VERSÃO:** ${versao}\n**MAPA:** ${mapa}\n\n**PARTICIPANTES:**\n${lista}`)
                .setFooter({ text: `Jogadores: ${slots.filter(s => s !== null).length}/${vagas}` });
        };

        const menu = new StringSelectMenuBuilder().setCustomId('sel_2v2').setPlaceholder('Escolha seu Time e Vaga')
            .addOptions(Array.from({ length: vagas }, (_, i) => {
                const tNum = Math.floor(i/2)+1; const sNum = (i%2)+1;
                return new StringSelectMenuOptionBuilder().setLabel(`Time ${tNum} - Vaga ${sNum}`).setValue(`${i}`);
            }));

        const res = await interaction.reply({ embeds: [gerarEmbed()], components: [new ActionRowBuilder().addComponents(menu)] });
        const col = res.createMessageComponentCollector({ time: expiraMin * 60000 });

        col.on('collect', async i => {
            if (slots.includes(i.user.id)) return i.reply({ content: 'Já em um time!', ephemeral: true });
            const vIdx = parseInt(i.values);
            if (slots[vIdx] !== null) return i.reply({ content: 'Vaga ocupada!', ephemeral: true });
            slots[vIdx] = i.user.id;
            if (slots.every(s => s !== null)) col.stop('lotado');
            else await i.update({ embeds: [gerarEmbed()] });
        });

        col.on('end', async (collected, reason) => {
            if (reason !== 'lotado') return interaction.editReply({ content: '❌ Expirado.', embeds: [], components: [] });
            await interaction.editReply({ embeds: [gerarEmbed(true)], components: [] });

            const canal = interaction.guild.channels.cache.get(ID_CONFRONTOS);
            
            // Monta as duplas fixas baseadas em quem sentou junto no menu
            let duplasFixas = [];
            for (let i = 0; i < slots.length; i += 2) {
                duplasFixas.push([slots[i], slots[i+1]]);
            }

            const proximaFase = async (listaDeDuplas) => {
                let vencedoresFase = [];
                const totalJogos = listaDeDuplas.length / 2;
                const ehFinal = listaDeDuplas.length === 2;

                for (let i = 0; i < listaDeDuplas.length; i += 2) {
                    const timeA = listaDeDuplas[i];
                    const timeB = listaDeDuplas[i+1];
                    const th = await canal.threads.create({ 
                        name: `${ehFinal ? '🏆-FINAL-2V2' : '⚔️-Duelo-2V2'}`, 
                        type: ChannelType.PrivateThread 
                    });
                    
                    [...timeA, ...timeB].forEach(id => th.members.add(id).catch(() => {}));

                    const bt = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`v2a_${ehFinal}`).setLabel('Vencer Time A').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId(`v2b_${ehFinal}`).setLabel('Vencer Time B').setStyle(ButtonStyle.Success)
                    );

                    await th.send({ 
                        content: `⚔️ **${ehFinal ? 'GRANDE FINAL 2V2' : 'CONFRONTO 2V2'}**\n**TIME A:** <@${timeA[0]}> & <@${timeA[1]}>\n**VS**\n**TIME B:** <@${timeB[0]}> & <@${timeB[1]}>\n\n**Org:** <@${ORGANIZADOR_ID}>`, 
                        components: [bt] 
                    });

                    const sCol = th.createMessageComponentCollector();
                    sCol.on('collect', async b => {
                        if (b.user.id !== ORGANIZADOR_ID) return b.reply({ content: 'Apenas o organizador!', ephemeral: true });
                        
                        const venceuA = b.customId.startsWith('v2a');
                        const isFinalMsg = b.customId.split('_')[1] === 'true';
                        const vTime = venceuA ? timeA : timeB;
                        const pTime = venceuA ? timeB : timeA;

                        if (isFinalMsg) {
                            const data = JSON.parse(fs.readFileSync(PATH, 'utf8'));
                            [...vTime, ...pTime].forEach(id => { if(!data[id]) data[id] = { simuV:0, simuP:0, apV:0, apP:0, x1V:0, x1P:0 }; });
                            vTime.forEach(id => data[id].simuV += 1);
                            pTime.forEach(id => data[id].simuP += 1);
                            fs.writeFileSync(PATH, JSON.stringify(data, null, 2));

                            if (fs.existsSync(CONFIG_PATH)) {
                                const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
                                const rC = await interaction.guild.channels.fetch(cfg.channelId);
                                const rM = await rC.messages.fetch(cfg.messageId);
                                const top = Object.entries(data).sort((a,b) => b[1].simuV - a[1].simuV).slice(0, 10);
                                let grade = "```md\nPOS  NOME            VITS   VICE\n---  ------------    ----   ----\n";
                                top.forEach(([id, s], idx) => {
                                    const n = (interaction.guild.members.cache.get(id)?.displayName || "Player").slice(0,12).padEnd(12,' ');
                                    grade += `${(idx+1).toString().padEnd(3,' ')}  ${n}    ${(s.simuV || 0).toString().padEnd(4,' ')}   ${(s.simuP || 0).toString().padEnd(4,' ')}\n`;
                                });
                                grade += "```";
                                await rM.edit({ embeds: [EmbedBuilder.from(rM.embeds[0]).setDescription(grade)] });
                            }
                        }

                        await b.update({ content: `🏆 Vitória confirmada: <@${vTime[0]}> & <@${vTime[1]}>`, components: [] });
                        
                        if (!isFinalMsg) {
                            vencedoresFase.push(vTime);
                            if (vencedoresFase.length === totalJogos) {
                                await interaction.followUp({ content: `📢 **Fase concluída!** Próximos jogos do 2v2 em instantes...` });
                                proximaFase(vencedoresFase);
                            }
                        }
                        setTimeout(() => th.delete().catch(() => {}), 15000);
                    });
                }
            };

            await proximaFase(duplasFixas);
        });
    }
};
