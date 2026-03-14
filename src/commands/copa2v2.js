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
            for (let i = 0; i < vagas; i += 2) {
                const p1 = slots[i] ? `<@${slots[i]}>` : '----';
                const p2 = slots[i+1] ? `<@${slots[i+1]}>` : '----';
                const status = chavesTimes[i/2] ? ' 🔒' : (slots[i] ? ' 🔓' : '');
                listaTimes += `**TIME ${(i/2)+1}:** ${p1}, ${p2}${status}\n`;
            }
            return new EmbedBuilder()
                .setTitle('🏆 COPA ALPHA 2V2')
                .setColor(encerrado ? '#ff0000' : '#2ecc71')
                .setDescription(`${encerrado ? '✅ **INSCRIÇÕES ENCERRADAS**' : `Expira em <t:${Math.floor((Date.now() + expiraMin * 60000) / 1000)}:R>`}\n\n**VERSÃO:** ${versao}\n**MAPA:** ${mapa}\n\n**PARTICIPANTES:**\n${listaTimes}`)
                .setFooter({ text: `Jogadores: ${slots.filter(s => s !== null).length}/${vagas}` });
        };

        const menu = new StringSelectMenuBuilder().setCustomId('sel_copa').setPlaceholder('Escolha seu Time')
            .addOptions(Array.from({ length: vagas / 2 }, (_, i) => {
                return new StringSelectMenuOptionBuilder().setLabel(`Time ${i + 1}`).setValue(`${i}`);
            }));

        const row = new ActionRowBuilder().addComponents(menu);
        const res = await interaction.reply({ embeds: [gerarEmbed()], components: [row] });
        const col = res.createMessageComponentCollector({ time: expiraMin * 60000 });

        col.on('collect', async i => {
            if (slots.includes(i.user.id)) return i.reply({ content: 'Você já está em um time!', ephemeral: true });
            
            const timeIdx = parseInt(i.values[0]);
            const v1 = timeIdx * 2;
            const v2 = (timeIdx * 2) + 1;

            if (slots[v1] !== null && slots[v2] !== null) return i.reply({ content: '❌ Time lotado!', ephemeral: true });

            // JOGADOR 1: CRIA TÓPICO PARA CONFIGURAR
            if (slots[v1] === null) {
                const thread = await i.channel.threads.create({
                    name: `⚙️ Config-Time-${timeIdx + 1}`,
                    type: ChannelType.PrivateThread,
                    autoArchiveDuration: 60
                });

                await thread.members.add(i.user.id);
                await i.reply({ content: `Acesse o tópico <#${thread.id}> para configurar seu time!`, ephemeral: true });

                const btns = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`f_${timeIdx}`).setLabel('Livre (Sem Senha)').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`k_${timeIdx}`).setLabel('Privado (Com Senha)').setStyle(ButtonStyle.Danger)
                );

                const msgThread = await thread.send({ content: `Olá <@${i.user.id}>, como o **Time ${timeIdx + 1}** será preenchido?`, components: [btns] });
                const bCol = msgThread.createMessageComponentCollector({ max: 1, time: 30000 });

                bCol.on('collect', async b => {
                    await b.deferUpdate();
                    slots[v1] = b.user.id;

                    if (b.customId.startsWith('f_')) {
                        chavesTimes[timeIdx] = null;
                        await thread.send('✅ Time definido como **Público**. Este tópico será excluído em 5s.');
                    } else {
                        const random = Math.floor(1000 + Math.random() * 9000);
                        const chave = `${b.user.id.substring(0, 2)}${random}`;
                        chavesTimes[timeIdx] = chave;
                        await thread.send(`🔐 Time **Privado**! Sua chave é: \`${chave}\`\nEnvie para seu duo. Este tópico será excluído em 10s.`);
                    }

                    await interaction.editReply({ embeds: [gerarEmbed()] });
                    setTimeout(() => thread.delete().catch(() => {}), 10000);
                    if (slots.every(s => s !== null)) col.stop('lotado');
                });
                return;
            }

            // JOGADOR 2: ENTRADA VIA MODAL (CASO TENHA CHAVE)
            if (chavesTimes[timeIdx]) {
                const modal = new ModalBuilder().setCustomId(`mod_${timeIdx}`).setTitle('Senha do Time');
                const input = new TextInputBuilder().setCustomId('key').setLabel('DIGITE A SENHA FORNECIDA PELO DUO').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(input));
                await i.showModal(modal);

                const subm = await i.awaitModalSubmit({ filter: m => m.user.id === i.user.id, time: 30000 }).catch(() => null);
                if (!subm) return;

                if (subm.fields.getTextInputValue('key') === chavesTimes[timeIdx]) {
                    slots[v2] = i.user.id;
                    await subm.reply({ content: '✅ Senha correta! Você entrou.', ephemeral: true });
                    await interaction.editReply({ embeds: [gerarEmbed()] });
                    if (slots.every(s => s !== null)) col.stop('lotado');
                } else { 
                    await subm.reply({ content: '❌ Senha incorreta!', ephemeral: true }); 
                }
            } else {
                slots[v2] = i.user.id;
                await i.reply({ content: '✅ Você entrou no time!', ephemeral: true });
                await interaction.editReply({ embeds: [gerarEmbed()] });
                if (slots.every(s => s !== null)) col.stop('lotado');
            }
        });

        col.on('end', async (_, reason) => {
            if (reason !== 'lotado') return interaction.editReply({ content: '❌ Inscrições encerradas por tempo ou cancelamento.', components: [] });
            
            await interaction.editReply({ embeds: [gerarEmbed(true)], components: [] });
            const canalConfrontos = interaction.guild.channels.cache.get(ID_CONFRONTOS);
            if (!canalConfrontos) return;

            for (let i = 0; i < slots.length; i += 4) {
                if (!slots[i+2]) break;

                const timeA = [slots[i], slots[i+1]];
                const timeB = [slots[i+2], slots[i+3]];

                const thread = await canalConfrontos.threads.create({
                    name: `⚔️ Jogo ${Math.floor(i/4) + 1} - 2v2`,
                    type: ChannelType.PrivateThread
                });

                [...timeA, ...timeB].forEach(id => thread.members.add(id).catch(() => {}));

                const embedJogo = new EmbedBuilder()
                    .setTitle('⚔️ CONFRONTO DEFINIDO')
                    .setColor('#e74c3c')
                    .addFields(
                        { name: 'Time A', value: `<@${timeA[0]}> & <@${timeA[1]}>`, inline: true },
                        { name: 'Time B', value: `<@${timeB[0]}> & <@${timeB[1]}>`, inline: true },
                        { name: 'Configurações', value: `**Mapa:** ${mapa}\n**Versão:** ${versao}` }
                    );

                await thread.send({ content: `🔥 Partida iniciada! <@${timeA[0]}> <@${timeA[1]}> VS <@${timeB[0]}> <@${timeB[1]}>`, embeds: [embedJogo] });
            }
        });
    },
};
