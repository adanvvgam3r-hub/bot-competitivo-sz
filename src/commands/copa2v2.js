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

        const row = new ActionRowBuilder().addComponents(menu);
        const res = await interaction.reply({ embeds: [gerarEmbed()], components: [row] });
        const col = res.createMessageComponentCollector({ time: expiraMin * 60000 });

        col.on('collect', async i => {
            if (slots.includes(i.user.id)) return i.reply({ content: 'Você já está em um time!', ephemeral: true });
            
            const timeIdx = parseInt(i.values[0]);
            const v1 = timeIdx * 2;
            const v2 = (timeIdx * 2) + 1;

            if (slots[v1] !== null && slots[v2] !== null) return i.reply({ content: '❌ Time lotado!', ephemeral: true });

            // ENTRANDO COMO PRIMEIRO DO TIME (CRIANDO OU NÃO CHAVE)
            if (slots[v1] === null) {
                const btns = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`f_${timeIdx}`).setLabel('Livre (Sem Senha)').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`k_${timeIdx}`).setLabel('Privado (Com Senha)').setStyle(ButtonStyle.Secondary)
                );

                const msgDecisao = await i.reply({ content: 'Como deseja configurar o time?', components: [btns], ephemeral: true });
                const bCol = msgDecisao.createMessageComponentCollector({ max: 1, time: 15000 });

                bCol.on('collect', async b => {
                    await b.deferUpdate(); // Evita o erro de interação falhou
                    if (b.customId.startsWith('f_')) {
                        slots[v1] = b.user.id;
                        chavesTimes[timeIdx] = null;
                        await b.editReply({ content: 'Você entrou no Time! (Acesso Livre)', components: [] });
                    } else {
                        const random = Math.floor(1000 + Math.random() * 9000);
                        const chave = `${b.user.id.substring(0, 2)}${random}`;
                        slots[v1] = b.user.id;
                        chavesTimes[timeIdx] = chave;
                        await b.editReply({ content: `Sua chave é: \`${chave}\` \nEnvie para seu duo!`, components: [] });
                    }
                    await interaction.editReply({ embeds: [gerarEmbed()] });
                    if (slots.every(s => s !== null)) col.stop('lotado');
                });
                return;
            }

            // ENTRANDO COMO SEGUNDO DO TIME
            if (chavesTimes[timeIdx]) {
                const modal = new ModalBuilder().setCustomId(`mod_${timeIdx}`).setTitle('Acesso ao Time');
                const input = new TextInputBuilder().setCustomId('key').setLabel('QUAL A SENHA?').setStyle(TextInputStyle.Short).setRequired(true);
                modal.addComponents(new ActionRowBuilder().addComponents(input));
                await i.showModal(modal);

                const subm = await i.awaitModalSubmit({ filter: m => m.user.id === i.user.id, time: 30000 }).catch(() => null);
                if (!subm) return;

                await subm.deferUpdate(); // Evita erro no modal

                if (subm.fields.getTextInputValue('key') === chavesTimes[timeIdx]) {
                    slots[v2] = i.user.id;
                    await interaction.editReply({ embeds: [gerarEmbed()] });
                    if (slots.every(s => s !== null)) col.stop('lotado');
                } else { 
                    await subm.followUp({ content: '❌ Chave incorreta!', ephemeral: true }); 
                }
            } else {
                await i.deferUpdate();
                slots[v2] = i.user.id;
                await interaction.editReply({ embeds: [gerarEmbed()] });
                if (slots.every(s => s !== null)) col.stop('lotado');
            }
        });

        col.on('end', async (_, reason) => {
            if (reason !== 'lotado') return interaction.editReply({ content: '❌ Copa expirada ou cancelada.', components: [] });
            
            await interaction.editReply({ embeds: [gerarEmbed(true)], components: [] });
            const canalConfrontos = interaction.guild.channels.cache.get(ID_CONFRONTOS);
            if (!canalConfrontos) return;

            // Organiza as duplas e cria os confrontos
            for (let i = 0; i < slots.length; i += 4) {
                if (!slots[i+2]) break; // Evita erro se não houver time B

                const timeA = [slots[i], slots[i+1]];
                const timeB = [slots[i+2], slots[i+3]];

                const thread = await canalConfrontos.threads.create({
                    name: `⚔️ Jogo ${Math.floor(i/4) + 1}`,
                    type: ChannelType.PrivateThread,
                    reason: 'Início de Copa 2v2'
                });

                [...timeA, ...timeB].forEach(id => thread.members.add(id).catch(() => {}));

                const embedJogo = new EmbedBuilder()
                    .setTitle('⚔️ CONFRONTO INICIADO')
                    .setColor('#e74c3c')
                    .addFields(
                        { name: 'Time A', value: `<@${timeA[0]}> & <@${timeA[1]}>`, inline: true },
                        { name: 'Time B', value: `<@${timeB[0]}> & <@${timeB[1]}>`, inline: true }
                    );

                await thread.send({ embeds: [embedJogo], content: 'Boa sorte a todos!' });
            }
        });
    }
};
