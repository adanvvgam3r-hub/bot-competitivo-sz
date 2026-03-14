const { 
    SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, 
    ButtonStyle, ChannelType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
    ModalBuilder, TextInputBuilder, TextInputStyle 
} = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('copa3v3')
        .setDescription('Copa 3v3 com chaves e tópicos automáticos')
        .addStringOption(o => o.setName('versao').setDescription('Versão').setRequired(true))
        .addIntegerOption(o => o.setName('vagas').setDescription('Total de jogadores').setRequired(true)
            .addChoices(
                {name:'6 (2 Times)', value:6},
                {name:'12 (4 Times)', value:12},
                {name:'24 (8 Times)', value:24}
            ))
        .addStringOption(o => o.setName('mapa').setDescription('Mapa').setRequired(true))
        .addIntegerOption(o => o.setName('expira').setDescription('Minutos').setRequired(true)),

    async execute(interaction) {
        const ID_DONO_ROLE = '1452822476949029001'; 
        const CANAL_PERMITIDO = '1465842384586670254';
        const ID_CONFRONTOS = '1474560305492394106';

        if (interaction.channel.id !== CANAL_PERMITIDO) return interaction.reply({ content: `❌ Canal incorreto!`, ephemeral: true });
        if (!interaction.member.roles.cache.has(ID_DONO_ROLE)) return interaction.reply({ content: '❌ Sem permissão!', ephemeral: true });

        const vagas = interaction.options.getInteger('vagas');
        const versao = interaction.options.getString('versao').toUpperCase();
        const mapa = interaction.options.getString('mapa').toUpperCase();
        const expiraMin = interaction.options.getInteger('expira');

        let slots = Array(vagas).fill(null);
        let chavesTimes = {}; 

        const gerarEmbed = (encerrado = false) => {
            let listaTimes = "";
            for (let i = 0; i < vagas; i += 3) {
                const p1 = slots[i] ? `<@${slots[i]}>` : '----';
                const p2 = slots[i+1] ? `<@${slots[i+1]}>` : '----';
                const p3 = slots[i+2] ? `<@${slots[i+2]}>` : '----';
                const status = chavesTimes[i/3] ? ' 🔒' : (slots[i] ? ' 🔓' : '');
                listaTimes += `**TIME ${(i/3)+1}:** ${p1}, ${p2}, ${p3}${status}\n`;
            }
            return new EmbedBuilder()
                .setTitle('🏆 COPA ALPHA 3V3')
                .setColor(encerrado ? '#ff0000' : '#3498db')
                .setDescription(`${encerrado ? '✅ **INSCRIÇÕES ENCERRADAS**' : `Expira em <t:${Math.floor((Date.now() + expiraMin * 60000) / 1000)}:R>`}\n\n**VERSÃO:** ${versao}\n**MAPA:** ${mapa}\n\n**PARTICIPANTES:**\n${listaTimes}`)
                .setFooter({ text: `Jogadores: ${slots.filter(s => s !== null).length}/${vagas}` });
        };

        const menu = new StringSelectMenuBuilder().setCustomId('sel_copa').setPlaceholder('Escolha seu Time')
            .addOptions(Array.from({ length: vagas / 3 }, (_, i) => {
                return new StringSelectMenuOptionBuilder().setLabel(`Time ${i + 1}`).setValue(`${i}`);
            }));

        const row = new ActionRowBuilder().addComponents(menu);
        const res = await interaction.reply({ embeds: [gerarEmbed()], components: [row] });
        const col = res.createMessageComponentCollector({ time: expiraMin * 60000 });

        col.on('collect', async i => {
            if (slots.includes(i.user.id)) return i.reply({ content: 'Você já está em um time!', ephemeral: true });
            
            const timeIdx = parseInt(i.values[0]);
            const v1 = timeIdx * 3;
            const v2 = (timeIdx * 3) + 1;
            const v3 = (timeIdx * 3) + 2;

            if (slots[v1] && slots[v2] && slots[v3]) return i.reply({ content: '❌ Time lotado!', ephemeral: true });

            // ENTRANDO COMO LÍDER DO TIME (Slot 1)
            if (slots[v1] === null) {
                await i.deferReply({ ephemeral: true });
                const thread = await i.channel.threads.create({
                    name: `⚙️ Config-3v3-T${timeIdx + 1}`,
                    type: ChannelType.PrivateThread,
                    autoArchiveDuration: 60
                });
                await thread.members.add(i.user.id);
                await i.editReply({ content: `Acesse <#${thread.id}> para configurar o acesso.` });

                const btns = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`f_${timeIdx}`).setLabel('Livre (Sem Senha)').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`k_${timeIdx}`).setLabel('Privado (Com Senha)').setStyle(ButtonStyle.Danger)
                );

                const msgThread = await thread.send({ content: `<@${i.user.id}>, defina a entrada do **Time ${timeIdx + 1}**:`, components: [btns] });
                const bCol = msgThread.createMessageComponentCollector({ max: 1, time: 30000 });

                bCol.on('collect', async b => {
                    await b.deferUpdate();
                    slots[v1] = b.user.id;
                    if (b.customId.startsWith('f_')) {
                        chavesTimes[timeIdx] = null;
                        await thread.send('✅ Time Público! Deletando tópico...');
                    } else {
                        const random = Math.floor(1000 + Math.random() * 9000);
                        const chave = `${b.user.id.substring(0, 2)}${random}`;
                        chavesTimes[timeIdx] = chave;
                        await thread.send(`🔐 Time Privado! Chave: \`${chave}\``);
                    }
                    await interaction.editReply({ embeds: [gerarEmbed()] });
                    setTimeout(() => thread.delete().catch(() => {}), 10000);
                    if (slots.every(s => s !== null)) col.stop('lotado');
                });
                return;
            }

            // FUNÇÃO PARA PREENCHER OS SLOTS RESTANTES (2 e 3)
            const preencherSlot = async (interacao) => {
                if (slots[v2] === null) slots[v2] = i.user.id;
                else slots[v3] = i.user.id;
                
                await interacao.editReply({ embeds: [gerarEmbed()] });
                if (slots.every(s => s !== null)) col.stop('lotado');
            };

            // ENTRANDO EM TIME COM SENHA
            if (chavesTimes[timeIdx]) {
                const modal = new ModalBuilder().setCustomId(`mod_${timeIdx}`).setTitle('Acesso ao Time');
                const input = new TextInputBuilder().setCustomId('key').setLabel('QUAL A SENHA?').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(input));
                await i.showModal(modal);

                const subm = await i.awaitModalSubmit({ filter: m => m.user.id === i.user.id, time: 30000 }).catch(() => null);
                if (!subm) return;
                await subm.deferUpdate();

                if (subm.fields.getTextInputValue('key') === chavesTimes[timeIdx]) {
                    await preencherSlot(interaction);
                } else {
                    await subm.followUp({ content: '❌ Chave incorreta!', ephemeral: true });
                }
            } else {
                // ENTRANDO EM TIME PÚBLICO
                await i.deferUpdate();
                await preencherSlot(interaction);
            }
        });

        col.on('end', async (_, reason) => {
            if (reason !== 'lotado') return interaction.editReply({ content: '❌ Inscrições encerradas ou expiradas.', components: [] });
            
            await interaction.editReply({ embeds: [gerarEmbed(true)], components: [] });
            const canalConfrontos = interaction.guild.channels.cache.get(ID_CONFRONTOS);
            if (!canalConfrontos) return;

            for (let i = 0; i < slots.length; i += 6) {
                const tA = [slots[i], slots[i+1], slots[i+2]];
                const tB = [slots[i+3], slots[i+4], slots[i+5]];

                if (!tB[0]) break; // Garante que há um oponente

                const thread = await canalConfrontos.threads.create({ 
                    name: `⚔️ Jogo ${Math.floor(i/6) + 1}`, 
                    type: ChannelType.PrivateThread 
                });

                [...tA, ...tB].forEach(id => thread.members.add(id).catch(() => {}));

                const embedJogo = new EmbedBuilder().setTitle('⚔️ CONFRONTO INICIADO').setColor('#e74c3c')
                    .addFields(
                        { name: '🔵 Time A', value: `<@${tA[0]}>\n<@${tA[1]}>\n<@${tA[2]}>`, inline: true },
                        { name: '🔴 Time B', value: `<@${tB[0]}>\n<@${tB[1]}>\n<@${tB[2]}>`, inline: true },
                        { name: '📍 Info', value: `**Mapa:** ${mapa}\n**Versão:** ${versao}` }
                    );

                const btnsVitoria = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('winA').setLabel('Vitória Time A').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('winB').setLabel('Vitória Time B').setStyle(ButtonStyle.Primary)
                );

                const msgVitoria = await thread.send({ 
                    content: `🔥 Que comece a batalha! <@${tA[0]}> <@${tA[1]}> <@${tA[2]}> VS <@${tB[0]}> <@${tB[1]}> <@${tB[2]}>`, 
                    embeds: [embedJogo], 
                    components: [btnsVitoria] 
                });

                const coletorVitoria = msgVitoria.createMessageComponentCollector();
                coletorVitoria.on('collect', async b => {
                    if (!b.member.roles.cache.has(ID_DONO_ROLE)) return b.reply({ content: "❌ Só o staff pode marcar a vitória!", ephemeral: true });
                    await b.deferUpdate();
                    const win = b.customId === 'winA' ? 'TIME A' : 'TIME B';
                    await thread.send(`🏆 **${win} VENCEU!** Tópico será excluído em 15s.`);
                    setTimeout(() => thread.delete().catch(() => {}), 15000);
                });
            }
        });
    }
};
