const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChannelType } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simu2v2')
        .setDescription('Simulador 2v2 com grade de times')
        .addStringOption(o => o.setName('versao').setDescription('Ex: guys, beast ou priv').setRequired(true))
        .addStringOption(o => o.setName('mapa').setDescription('Mapa da partida').setRequired(true))
        .addIntegerOption(o => o.setName('expira').setDescription('Minutos para expirar').setRequired(true)),

    async execute(interaction) {
        const ID_STAFF = '1453126709447754010';
        const ID_CANAL_TOPICOS = '1474560305492394106';
        const RANK_PATH = '/app/data/ranking.json';

        const v = interaction.options.getString('versao');
        const mapa = interaction.options.getString('mapa').toUpperCase();
        const expira = interaction.options.getInteger('expira');

        // Estrutura da Grade (Slots)
        let slots = {
            t1: { p1: null, p2: null },
            t2: { p1: null, p2: null }
        };

        const gerarGradeEmbed = (cor = '#0099ff', status = '🟢 SELEÇÃO DE TIMES') => {
            const format = (id) => id ? `<@${id}>` : '` Vazio `';
            
            return new EmbedBuilder()
                .setTitle(`🏆 SIMULADOR 2V2 - ${status}`)
                .setColor(cor)
                .setDescription(`**MAPA:** ${mapa} | **VERSÃO:** ${v.toUpperCase()}`)
                .addFields(
                    { name: '🔵 TIME 1', value: `Slot 1: ${format(slots.t1.p1)}\nSlot 2: ${format(slots.t1.p2)}`, inline: true },
                    { name: '🔴 TIME 2', value: `Slot 1: ${format(slots.t2.p1)}\nSlot 2: ${format(slots.t2.p2)}`, inline: true }
                )
                .setFooter({ text: `alpha • Clique em um slot para entrar` });
        };

        const botoes = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('t1_p1').setLabel('T1 - Slot 1').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('t1_p2').setLabel('T1 - Slot 2').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('t2_p1').setLabel('T2 - Slot 1').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId('t2_p2').setLabel('T2 - Slot 2').setStyle(ButtonStyle.Danger)
        );

        const res = await interaction.reply({ embeds: [gerarGradeEmbed()], components: [botoes] });

        const col = res.createMessageComponentCollector({ time: expira * 60000 });

        col.on('collect', async i => {
            // Verifica se o jogador já está em QUALQUER slot
            const todosIds = [slots.t1.p1, slots.t1.p2, slots.t2.p1, slots.t2.p2];
            if (todosIds.includes(i.user.id)) {
                return i.reply({ content: '❌ Você já está na grade! Saia para trocar (Alpha: solicite à Staff).', ephemeral: true });
            }

            // Atribuição de slot
            const [time, slot] = i.customId.split('_');
            if (slots[time][slot]) return i.reply({ content: '❌ Este slot já foi ocupado!', ephemeral: true });

            slots[time][slot] = i.user.id;

            // Se todos os 4 slots lotarem
            if (slots.t1.p1 && slots.t1.p2 && slots.t2.p1 && slots.t2.p2) {
                col.stop('lotado');
            } else {
                await i.update({ embeds: [gerarGradeEmbed()] });
            }
        });

        col.on('end', async (collected, reason) => {
            if (reason === 'lotado') {
                const getNome = (id) => interaction.guild.members.cache.get(id)?.displayName.slice(0,6) || 'P';
                const nomesT1 = `${getNome(slots.t1.p1)}+${getNome(slots.t1.p2)}`;
                const nomesT2 = `${getNome(slots.t2.p1)}+${getNome(slots.t2.p2)}`;

                const bracket = "```md\n# ⚔️ FINAL 2V2\n" + `${nomesT1} vs ${nomesT2}\n` + "```";
                
                await interaction.editReply({ 
                    embeds: [new EmbedBuilder().setTitle('⚔️ GRADE FECHADA').setDescription(bracket).setColor('#00ff00')], 
                    components: [] 
                });

                // Criar Tópico Privado
                const canal = interaction.guild.channels.cache.get(ID_CANAL_TOPICOS);
                const th = await canal.threads.create({ name: `2v2-${nomesT1}-vs-${nomesT2}`, type: ChannelType.PrivateThread });
                
                const ids = [slots.t1.p1, slots.t1.p2, slots.t2.p1, slots.t2.p2];
                ids.forEach(id => th.members.add(id));

                const rowV = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('v_t1').setLabel(`Vencer: ${nomesT1}`).setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('v_t2').setLabel(`Vencer: ${nomesT2}`).setStyle(ButtonStyle.Danger)
                );

                const msgTh = await th.send({ 
                    content: `⚔️ **CONFRONTO 2V2**\n🔵 Time 1: <@${slots.t1.p1}>+<@${slots.t1.p2}>\n🔴 Time 2: <@${slots.t2.p1}>+<@${slots.t2.p2}>`, 
                    components: [rowV] 
                });
                
                const sCol = msgTh.createMessageComponentCollector();
                sCol.on('collect', async b => {
                    if (!b.member.roles.cache.has(ID_STAFF)) return b.reply({ content: 'Apenas Staff!', ephemeral: true });

                    const vencIds = b.customId === 'v_t1' ? [slots.t1.p1, slots.t1.p2] : [slots.t2.p1, slots.t2.p2];
                    const perdIds = b.customId === 'v_t1' ? [slots.t2.p1, slots.t2.p2] : [slots.t1.p1, slots.t1.p2];
                    const vNome = b.customId === 'v_t1' ? nomesT1 : nomesT2;

                    // Salvar Ranking no Volume
                    let r = JSON.parse(fs.readFileSync(RANK_PATH, 'utf8'));
                    vencIds.forEach(id => {
                        if(!r[id]) r[id] = { simuV: 0, simuP: 0, apV: 0, apP: 0, x1V: 0, x1P: 0 };
                        r[id].simuV += 1;
                    });
                    perdIds.forEach(id => {
                        if(!r[id]) r[id] = { simuV: 0, simuP: 0, apV: 0, apP: 0, x1V: 0, x1P: 0 };
                        r[id].simuP += 1;
                    });
                    fs.writeFileSync(RANK_PATH, JSON.stringify(r, null, 2));

                    const finalB = "```md\n# ⚔️ RESULTADO 2V2\n" + (b.customId === 'v_t1' ? `>${nomesT1}< vs ${nomesT2}` : `${nomesT1} vs >${nomesT2}<`) + `\n\n🏆 CAMPEÕES: ${vNome}\n` + "```";
                    await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🏆 RESULTADO').setDescription(finalB).setColor('#ffff00')] });

                    await b.update({ content: `🏆 Vitória confirmada para ${vNome}!`, components: [] });
                    setTimeout(() => th.delete().catch(() => {}), 15000);
                });

            } else if (reason === 'time') {
                await interaction.editReply({ content: '❌ Expirado por tempo.', embeds: [], components: [] });
                setTimeout(() => interaction.deleteReply().catch(() => {}), 15000);
            }
        });
    }
};
