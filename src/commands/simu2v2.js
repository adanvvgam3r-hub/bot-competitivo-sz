const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChannelType } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simu2v2')
        .setDescription('Simulador 2v2 com Seleção de Times e Ranking')
        .addStringOption(o => o.setName('versao').setDescription('Ex: guys, beast ou priv').setRequired(true))
        .addStringOption(o => o.setName('mapa').setDescription('Mapa da partida').setRequired(true))
        .addIntegerOption(o => o.setName('expira').setDescription('Minutos para expirar').setRequired(true)),

    async execute(interaction) {
        const ID_STAFF = '1453126709447754010';
        const ID_CANAL_TOPICOS = '1474560305492394106';
        const RANK_PATH = '/app/data/ranking.json';
        const CONFIG_PATH = '/app/data/ranking_config.json';

        const v = interaction.options.getString('versao');
        const mapa = interaction.options.getString('mapa').toUpperCase();
        const expira = interaction.options.getInteger('expira');

        let time1 = []; // Slot A e B
        let time2 = []; // Slot A e B
        const limite = 2;

        const gerarEmbed = (status = '🟢 SELEÇÃO ABERTA', cor = '#0099ff') => {
            const f = (t) => t.length > 0 ? t.map(id => `<@${id}>`).join('\n') : '*Vazio*';
            return new EmbedBuilder()
                .setTitle(`🏆 SIMULADOR 2V2 - ${status}`)
                .setColor(cor)
                .addFields(
                    { name: '🗺️ MAPA', value: mapa, inline: true },
                    { name: '🎮 VERSÃO', value: v.toUpperCase(), inline: true },
                    { name: '🔵 TIME 1', value: f(time1), inline: true },
                    { name: '🔴 TIME 2', value: f(time2), inline: true }
                )
                .setFooter({ text: `alpha • Use o menu abaixo` });
        };

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('select_time')
                .setPlaceholder('[ ESCOLHA SEU TIME > ]')
                .addOptions(
                    { label: 'Time 1 (Slot A/B)', value: 't1', description: 'Entrar no time Azul' },
                    { label: 'Time 2 (Slot A/B)', value: 't2', description: 'Entrar no time Vermelho' }
                )
        );

        const res = await interaction.reply({ embeds: [gerarEmbed()], components: [menu] });
        const col = res.createMessageComponentCollector({ time: expira * 60000 });

        col.on('collect', async i => {
            if (time1.includes(i.user.id) || time2.includes(i.user.id)) {
                return i.reply({ content: '❌ Você já está em um time!', ephemeral: true });
            }

            if (i.values[0] === 't1') {
                if (time1.length >= limite) return i.reply({ content: '❌ Time 1 lotado!', ephemeral: true });
                time1.push(i.user.id);
            } else {
                if (time2.length >= limite) return i.reply({ content: '❌ Time 2 lotado!', ephemeral: true });
                time2.push(i.user.id);
            }

            if (time1.length === limite && time2.length === limite) col.stop('lotado');
            else await i.update({ embeds: [gerarEmbed()] });
        });

        col.on('end', async (collected, reason) => {
            if (reason === 'lotado') {
                const n1 = time1.map(id => interaction.guild.members.cache.get(id)?.displayName.slice(0,6) || "P").join('+');
                const n2 = time2.map(id => interaction.guild.members.cache.get(id)?.displayName.slice(0,6) || "P").join('+');

                const draw = (venc = null) => {
                    let b = "```md\n# ⚔️ FINAL 2V2\n";
                    if (!venc) b += `${n1} vs ${n2}\n`;
                    else b += venc === 't1' ? `>${n1}< vs ${n2}\n🏆 CAMPEÕES: ${n1}` : `${n1} vs >${n2}<\n🏆 CAMPEÕES: ${n2}`;
                    return b + "```";
                };

                await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('⚔️ GRADE FECHADA').setDescription(draw()).setColor('#00ff00')], components: [] });

                const thread = await interaction.guild.channels.cache.get(ID_CANAL_TOPICOS).threads.create({ 
                    name: `2v2-${n1}-vs-${n2}`, 
                    type: ChannelType.PrivateThread 
                });
                
                [...time1, ...time2].forEach(id => thread.members.add(id));

                const rowV = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('v1').setLabel(`Vencer: ${n1}`).setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId('v2').setLabel(`Vencer: ${n2}`).setStyle(ButtonStyle.Danger)
                );

                const msgT = await thread.send({ content: `Staff <@&${ID_STAFF}>, declare o vencedor:`, components: [rowV] });
                
                msgT.createMessageComponentCollector().on('collect', async b => {
                    if (!b.member.roles.cache.has(ID_STAFF)) return b.reply({ content: 'Apenas Staff!', ephemeral: true });

                    const vencIds = b.customId === 'v1' ? time1 : time2;
                    const perdIds = b.customId === 'v1' ? time2 : time1;

                    // 💾 SALVAR NO VOLUME
                    let data = JSON.parse(fs.readFileSync(RANK_PATH, 'utf8'));
                    vencIds.forEach(id => {
                        if (!data[id]) data[id] = { simuV: 0, simuP: 0, apV: 0, apP: 0, x1V: 0, x1P: 0 };
                        data[id].simuV += 1;
                    });
                    perdIds.forEach(id => {
                        if (!data[id]) data[id] = { simuV: 0, simuP: 0, apV: 0, apP: 0, x1V: 0, x1P: 0 };
                        data[id].simuP += 1;
                    });
                    fs.writeFileSync(RANK_PATH, JSON.stringify(data, null, 2));

                    // 📢 ATUALIZAR MENSAGEM FIXA
                    try {
                        const conf = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
                        const ch = await interaction.guild.channels.fetch(conf.channelId);
                        const mF = await ch.messages.fetch(conf.messageId);
                        const top10 = Object.entries(data).sort((a,b) => b[1].simuV - a[1].simuV).slice(0,10);
                        const emb = new EmbedBuilder().setTitle('🏆 RANKING ATUALIZADO').setColor('#f1c40f')
                            .setDescription(top10.map((u, i) => `${i+1}º | <@${u[0]}> — **${u[1].simuV} Vitórias**`).join('\n'));
                        await mF.edit({ embeds: [emb] });
                    } catch (e) { console.log("Poste o ranking fixo primeiro!"); }

                    await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🏆 RESULTADO FINAL').setDescription(draw(b.customId === 'v1' ? 't1' : 't2')).setColor('#ffff00')] });
                    await b.update({ content: `🏆 Vitória confirmada!`, components: [] });
                    setTimeout(() => thread.delete().catch(() => {}), 10000);
                });

            } else if (reason === 'time') {
                await interaction.editReply({ content: '❌ Expirado.', embeds: [], components: [] });
            }
        });
    }
};
