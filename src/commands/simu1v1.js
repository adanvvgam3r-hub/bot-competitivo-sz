const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChannelType } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simu1v1')
        .setDescription('Simulador 1v1 com Ranking Automático')
        .addStringOption(o => o.setName('versao').setDescription('guys, beast, priv').setRequired(true))
        .addIntegerOption(o => o.setName('vagas').setDescription('Vagas').setRequired(true).addChoices({name:'2',value:2},{name:'4',value:4},{name:'8',value:8}))
        .addStringOption(o => o.setName('mapa').setDescription('Mapa').setRequired(true))
        .addIntegerOption(o => o.setName('expira').setDescription('Minutos').setRequired(true)),

    async execute(interaction) {
        const ID_STAFF = '1453126709447754010';
        const ID_CANAL_TOPICOS = '1474560305492394106';
        const RANK_PATH = '/app/data/ranking.json';
        const CONFIG_PATH = '/app/data/ranking_config.json';

        const vagas = interaction.options.getInteger('vagas');
        const expira = interaction.options.getInteger('expira');
        let inscritos = [];

        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('in').setLabel('INSCREVER').setStyle(ButtonStyle.Primary));
        const res = await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🏆 SIMU ABERTO').setFooter({text: `(0/${vagas})`})], components: [row] });

        const col = res.createMessageComponentCollector({ time: expira * 60000 });
        col.on('collect', async i => {
            if (inscritos.includes(i.user.id)) return i.reply({ content: 'Já inscrito!', ephemeral: true });
            inscritos.push(i.user.id);
            if (inscritos.length === vagas) col.stop('lotado');
            else await i.update({ embeds: [new EmbedBuilder().setTitle('🏆 SIMU').setFooter({text: `(${inscritos.length}/${vagas})`})] });
        });

        col.on('end', async (c, reason) => {
            if (reason === 'lotado') {
                const p = [...inscritos].map(id => interaction.guild.members.cache.get(id)?.displayName.slice(0,8) || id.slice(0,4));
                let bracket = { p, v: ["Venc A", "Venc B", "Finalista", "CAMPEÃO"] };

                const desenhar = () => "```md\n# ⚔️ BRACKET\n" + `${bracket.p[0]} vs ${bracket.p[1]} ➔ ${bracket.v[0]}\n` + "```";
                await interaction.editReply({ embeds: [new EmbedBuilder().setDescription(desenhar()).setColor('#00ff00')], components: [] });

                const thread = await interaction.guild.channels.cache.get(ID_CANAL_TOPICOS).threads.create({ name: `SimuCH-${Math.floor(1000+Math.random()*9000)}`, type: ChannelType.PrivateThread });
                inscritos.forEach(id => thread.members.add(id));

                const msgT = await thread.send({ content: 'Staff, declare o vencedor:', components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`v_${inscritos[0]}`).setLabel('P1 Venceu').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`v_${inscritos[1]}`).setLabel('P2 Venceu').setStyle(ButtonStyle.Success)
                )] });

                msgT.createMessageComponentCollector().on('collect', async b => {
                    if (!b.member.roles.cache.has(ID_STAFF)) return b.reply({ content: 'Sem cargo!', ephemeral: true });
                    const vId = b.customId.replace('v_', '');
                    
                    // 💾 SALVAR NO VOLUME
                    let data = JSON.parse(fs.readFileSync(RANK_PATH, 'utf8'));
                    if (!data[vId]) data[vId] = { simuV: 0, simuP: 0, apV: 0, apP: 0, x1V: 0, x1P: 0 };
                    data[vId].simuV += 1;
                    fs.writeFileSync(RANK_PATH, JSON.stringify(data, null, 2));

                    // 📢 ATUALIZAR MENSAGEM FIXA AUTOMATICAMENTE
                    try {
                        const conf = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
                        const ch = await interaction.guild.channels.fetch(conf.channelId);
                        const mF = await ch.messages.fetch(conf.messageId);
                        const top10 = Object.entries(data).sort((a,b) => b[1].simuV - a[1].simuV).slice(0,10);
                        const emb = new EmbedBuilder().setTitle('🏆 RANKING ATUALIZADO').setColor('#f1c40f')
                            .setDescription(top10.map((u, i) => `${i+1}º | <@${u[0]}> — **${u[1].simuV} Vitórias**`).join('\n'));
                        await mF.edit({ embeds: [emb] });
                    } catch (e) { console.log("Poste o ranking fixo primeiro!"); }

                    await b.update({ content: `🏆 Vitória de <@${vId}> salva!`, components: [] });
                    setTimeout(() => thread.delete().catch(() => {}), 10000);
                });
            }
        });
    }
};

