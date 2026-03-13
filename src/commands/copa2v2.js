const { 
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, 
    ButtonStyle, ChannelType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
    ModalBuilder, TextInputBuilder, TextInputStyle 
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('copa2v2')
        .setDescription('Copa 2v2 com chaves efêmeras e tópicos automáticos')
        .addStringOption(o => o.setName('versao').setDescription('Versão').setRequired(true))
        .addIntegerOption(o => o.setName('vagas').setDescription('Total de jogadores').setRequired(true)
            .addChoices(
                {name:'4 (2 Times)', value:4},
                {name:'8 (4 Times)', value:8},
                {name:'16 (8 Times)', value:16}
            ))
        .addStringOption(o => o.setName('mapa').setDescription('Mapa').setRequired(true))
        .addIntegerOption(o => o.setName('expira').setDescription('Minutos').setRequired(true)),

    async execute(interaction) {
        const ID_STAFF = '1453126709447754010';
        const CANAL_PERMITIDO = '1465842384586670254';
        const ID_CONFRONTOS = '1474560305492394106';
        const ORGANIZADOR_ID = interaction.user.id;

        if (interaction.channel.id !== CANAL_PERMITIDO) return interaction.reply({ content: `❌ Canal incorreto!`, ephemeral: true });
        if (!interaction.member.roles.cache.has(ID_STAFF)) return interaction.reply({ content: '❌ Sem permissão!', ephemeral: true });

        const vagas = interaction.options.getInteger('vagas');
        const versao = interaction.options.getString('versao').toUpperCase();
        const mapa = interaction.options.getString('mapa').toUpperCase();
        const expiraMin = interaction.options.getInteger('expira');

        let slots = Array(vagas).fill(null);
        let chavesTimes = {}; 

        const gerarEmbed = (encerrado = false) => {
            let listaTimes = "";
            for (let i = 0; i < vagas; i += 2) {
                const p1 = slots[i] ? `<@${slots[i]}>` : '----';
                const p2 = slots[i+1] ? `<@${slots[i+1]}>` : '----';
                const status = chavesTimes[i/2] ? ' 🔒' : '';
                listaTimes += `**TIME ${(i/2)+1}:** ${p1}, ${p2}${status}\n`;
            }
            return new EmbedBuilder()
                .setTitle('🏆 COPA ALPHA 2V2')
                .setColor(encerrado ? '#00ff00' : '#2ecc71')
                .setDescription(`${encerrado ? '✅ **INSCRIÇÕES ENCERRADAS**' : `Expira em <t:${Math.floor((Date.now() + expiraMin * 60000) / 1000)}:R>`}\n\n**VERSÃO:** ${versao}\n**MAPA:** ${mapa}\n\n**PARTICIPANTES:**\n${listaTimes}`)
                .setFooter({ text: `Jogadores: ${slots.filter(s => s !== null).length}/${vagas}` });
        };

        const menu = new StringSelectMenuBuilder().setCustomId('sel_copa').setPlaceholder('Escolha seu Time')
            .addOptions(Array.from({ length: vagas / 2 }, (_, i) => {
                return new StringSelectMenuOptionBuilder().setLabel(`Time ${i + 1}`).setValue(`${i}`);
            }));

        const res = await interaction.reply({ embeds: [gerarEmbed()], components: [new ActionRowBuilder().addComponents(menu)] });
        const col = res.createMessageComponentCollector({ time: expiraMin * 60000 });

        col.on('collect', async i => {
            if (slots.includes(i.user.id)) return i.reply({ content: 'Você já está em um time!', ephemeral: true });
            const timeIdx = parseInt(i.values);
            const v1 = timeIdx * 2;
            const v2 = (timeIdx * 2) + 1;

            if (slots[v1] !== null && slots[v2] !== null) return i.reply({ content: '❌ Time lotado!', ephemeral: true });

            // --- FLUXO 0/2 (ENTRADA E CHAVE) ---
            if (slots[v1] === null) {
                const btns = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`f_${timeIdx}`).setLabel('Continuar sem Chave').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`k_${timeIdx}`).setLabel('Gerar uma Chave').setStyle(ButtonStyle.Secondary)
                );

                const msgDecisao = await i.reply({ content: 'Como deseja entrar no time?', components: [btns], ephemeral: true });
                const bCol = msgDecisao.createMessageComponentCollector({ max: 1, time: 15000 });

                bCol.on('collect', async b => {
                    await b.deferUpdate(); // ✅ CORRIGE O ERRO DE INTERAÇÃO
                    if (b.customId.startsWith('f_')) {
                        slots[v1] = b.user.id;
                        chavesTimes[timeIdx] = null;
                        await b.editReply({ content: 'Você entrou no Time (Acesso Livre)!', components: [] });
                    } else {
                        const random = Math.floor(1000 + Math.random() * 9000);
                        const chave = `${b.user.id.substring(0, 2)}${random}${b.user.id.substring(b.user.id.length - 2)}`;
                        slots[v1] = b.user.id;
                        chavesTimes[timeIdx] = chave;
                        await b.editReply({ content: `Sua chave de time é: \`${chave}\` \nCompartilhe com seu duo para que ele possa entrar no seu time!`, components: [] });
                    }
                    await interaction.editReply({ embeds: [gerarEmbed()] });
                    if (slots.every(s => s !== null)) col.stop('lotado');
                });
                return;
            }

            // --- FLUXO 1/2 (VERIFICAÇÃO DE CHAVE) ---
            if (chavesTimes[timeIdx]) {
                const modal = new ModalBuilder().setCustomId(`mod_${timeIdx}`).setTitle('Acesso ao Time');
                const input = new TextInputBuilder().setCustomId('key').setLabel('QUAL A SENHA?').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(input));
                await i.showModal(modal);

                const subm = await i.awaitModalSubmit({ filter: m => m.user.id === i.user.id, time: 30000 }).catch(() => null);
                if (!subm) return;

                if (subm.fields.getTextInputValue('key') === chavesTimes[timeIdx]) {
                    slots[v2] = i.user.id;
                    if (slots.every(s => s !== null)) col.stop('lotado');
                    else await subm.update({ embeds: [gerarEmbed()] });
                } else { await subm.reply({ content: '❌ Chave incorreta!', ephemeral: true }); }
            } else {
                slots[v2] = i.user.id;
                if (slots.every(s => s !== null)) col.stop('lotado');
                else await i.update({ embeds: [gerarEmbed()] });
            }
        });

        col.on('end', async (_, reason) => {
            if (reason !== 'lotado') return interaction.editReply({ content: '❌ Copa expirada ou cancelada.', components: [] });
            await interaction.editReply({ embeds: [gerarEmbed(true)], components: [] });

            const canal = interaction.guild.channels.cache.get(ID_CONFRONTOS);
            let duplasAtuais = [];
            for (let i = 0; i < slots.length; i += 2) { duplasAtuais.push([slots[i], slots[i+1]]); }

            // --- LÓGICA DE FASES RECURSIVAS ---
            const proximaFase = async (listaDeDuplas) => {
                let vencedoresFase = [];
                const totalJogos = listaDeDuplas.length / 2;
                const ehFinal = listaDeDuplas.length === 2;

                for (let i = 0; i < listaDeDuplas.length; i += 2) {
                    const tA = listaDeDuplas[i]; const tB = listaDeDuplas[i+1];
                    const th = await canal.threads.create({ 
                        name: `${ehFinal ? '🏆-FINAL-COPA' : '⚔️-Duelo-COPA'}`, 
                        type: ChannelType.PrivateThread 
                    });
                    [...tA, ...tB].forEach(id => th.members.add(id).catch(() => {}));

                    const bt = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`v_a`).setLabel('Vencer Time A').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId(`v_b`).setLabel('Vencer Time B').setStyle(ButtonStyle.Success)
                    );

                    await th.send({ 
                        content: `⚔️ **${ehFinal ? 'GRANDE FINAL COPA' : 'CONFRONTO COPA'}**\n**TIME A:** <@${tA[0]}> & <@${tA[1]}>\n**VS**\n**TIME B:** <@${tB[0]}> & <@${tB[1]}>\n\n**Org:** <@${ORGANIZADOR_ID}>`, 
                        components: [bt] 
                    });

                    const sCol = th.createMessageComponentCollector();
                    sCol.on('collect', async b => {
                        if (b.user.id !== ORGANIZADOR_ID) return b.reply({ content: 'Apenas organizador!', ephemeral: true });
                        const vTime = b.customId === 'v_a' ? tA : tB;

                        await b.update({ content: `🏆 Vitória: <@${vTime[0]}> & <@${vTime[1]}>`, components: [] });
                        
                        if (!ehFinal) {
                            vencedoresFase.push(vTime);
                            if (vencedoresFase.length === totalJogos) {
                                await interaction.channel.send({ content: `📢 **Fase concluída!** Gerando próximos tópicos...` });
                                proximaFase(vencedoresFase);
                            }
                        } else {
                            await interaction.channel.send({ content: `🎉 **COPA FINALIZADA!** Campeões: <@${vTime[0]}> & <@${vTime[1]}>` });
                        }
                        
                        setTimeout(() => th.delete().catch(() => {}), 15000);
                        sCol.stop();
                    });
                }
            };
            await proximaFase(duplasAtuais);
        });
    }
};
