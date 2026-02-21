const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChannelType } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simu2v2')
        .setDescription('🏆 Simulador 2v2 Profissional - Grade e Chaveamento')
        .addStringOption(o => o.setName('versao').setDescription('Ex: guys, beast ou priv').setRequired(true))
        .addIntegerOption(o => o.setName('vagas').setDescription('Total de jogadores').setRequired(true).addChoices(
            {name: '4 Jogadores (2 duplas)', value: 4},
            {name: '8 Jogadores (4 duplas)', value: 8},
            {name: '12 Jogadores (6 duplas)', value: 12}
        ))
        .addStringOption(o => o.setName('mapa').setDescription('Mapa da partida').setRequired(true))
        .addIntegerOption(o => o.setName('expira').setDescription('Minutos para expirar').setRequired(true)),

    async execute(interaction) {
        const ID_STAFF = '1453126709447754010';
        const ID_ADV = '1467222875399393421';
        const ID_CANAL_TOPICOS = '1474560305492394106';
        const RANK_PATH = '/app/data/ranking.json';
        const CONFIG_PATH = '/app/data/ranking_config.json';

        // 🔒 TRAVA: APENAS O CRIADOR CONTROLA A STAFF
        const criadorId = interaction.user.id;

        if (interaction.member.roles.cache.has(ID_ADV)) return interaction.reply({ content: '❌ Você possui uma **Advertência**!', ephemeral: true });
        if (!interaction.member.roles.cache.has(ID_STAFF) && interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ content: '❌ Apenas Organizadores podem usar este comando!', ephemeral: true });
        }

        const v = interaction.options.getString('versao').toUpperCase();
        const vagas = interaction.options.getInteger('vagas');
        const mapa = interaction.options.getString('mapa').toUpperCase();
        const expira = interaction.options.getInteger('expira');

        // 🗂️ ESTRUTURA DA GRADE
        let duplas = [];
        for (let i = 0; i < vagas / 2; i++) {
            duplas.push({ id: i + 1, p1: null, p1n: null, p2: null, p2n: null, vencNome: null });
        }

        const gerarGrade = (cor = '#0099ff', status = '🟢 SELEÇÃO DE TIMES') => {
            const embed = new EmbedBuilder()
                .setTitle(`🏆 SIMULADOR 2V2 - ${status}`)
                .setColor(cor)
                .setDescription(`**MAPA:** \`${mapa}\` | **VERSÃO:** \`${v}\``)
                .setFooter({ text: `Organizador: ${interaction.user.username} • alpha` });

            duplas.forEach(d => {
                const j1 = d.p1 ? `<@${d.p1}>` : '*Vazio*';
                const j2 = d.p2 ? `<@${d.p2}>` : '*Vazio*';
                embed.addFields({ name: `👥 DUPLA ${d.id}`, value: `**Slot A:** ${j1}\n**Slot B:** ${j2}`, inline: true });
            });
            return embed;
        };

        const gerarBotoes = () => {
            const rows = [];
            let row = new ActionRowBuilder();
            duplas.forEach((d, idx) => {
                if (row.components.length >= 4) { rows.push(row); row = new ActionRowBuilder(); }
                row.addComponents(
                    new ButtonBuilder().setCustomId(`d_${idx}_p1`).setLabel(`D${d.id}-A`).setStyle(ButtonStyle.Secondary).setDisabled(!!d.p1),
                    new ButtonBuilder().setCustomId(`d_${idx}_p2`).setLabel(`D${d.id}-B`).setStyle(ButtonStyle.Secondary).setDisabled(!!d.p2)
                );
            });
            rows.push(row);
            return rows;
        };

        const res = await interaction.reply({ embeds: [gerarGrade()], components: gerarBotoes() });
        const colIns = res.createMessageComponentCollector({ componentType: ComponentType.Button, time: expira * 60000 });

        colIns.on('collect', async i => {
            const todosIds = duplas.flatMap(d => [d.p1, d.p2]);
            if (todosIds.includes(i.user.id)) return i.reply({ content: '❌ Você já escolheu um slot!', ephemeral: true });

            const [, dIdx, slot] = i.customId.split('_');
            duplas[dIdx][slot] = i.user.id;
            duplas[dIdx][slot + 'n'] = i.user.username.slice(0,6);

            const total = duplas.flatMap(d => [d.p1, d.p2]).filter(id => id !== null).length;

            if (total === vagas) colIns.stop('lotado');
            else await i.update({ embeds: [gerarGrade()], components: gerarBotoes() });
        });

        colIns.on('end', async (collected, reason) => {
            if (reason === 'lotado') {
                // 🎨 DESENHO DA BRACKET 2V2
                const desenhar = () => {
                    let b = "```md\n# ⚔️ BRACKET 2V2 - ALPHA\n\n";
                    const f = (d1, d2, vNome) => {
                        const n1 = `${d1.p1n || '?'}+${d1.p2n || '?'}`;
                        const n2 = `${d2.p1n || '?'}+${d2.p2n || '?'}`;
                        if (!vNome) return `${n1} vs ${n2}`;
                        return vNome === n1 ? `>${n1}< vs ${n2}` : `${n1} vs >${n2}<`;
                    };

                    if (vagas === 4) {
                        b += `[GRANDE FINAL]\n⭐ ${f(duplas[0], duplas[1], duplas[0].vencNome || duplas[1].vencNome)}\n`;
                    } else if (vagas === 8) {
                        b += `[SEMIFINAIS]\n1. ${f(duplas[0], duplas[1], duplas[0].vencNome)}\n2. ${f(duplas[2], duplas[3], duplas[2].vencNome)}\n\n`;
                        b += `[GRANDE FINAL]\n⭐ FINALISTA A vs FINALISTA B\n`;
                    }
                    return b + "```";
                };

                await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('⚔️ GRADE FECHADA').setDescription(desenhar()).setColor('#00ff00')], components: [] });

                const canal = interaction.guild.channels.cache.get(ID_CANAL_TOPICOS);

                // 🕹️ GERENCIADOR DE CONFRONTOS 2V2
                const iniciarMatch = async (d1, d2, index) => {
                    const thread = await canal.threads.create({ 
                        name: `Simu2v2-D${d1.id}-vs-D${d2.id}`, 
                        type: ChannelType.PrivateThread 
                    });

                    [d1.p1, d1.p2, d2.p1, d2.p2].forEach(id => thread.members.add(id));

                    const rowV = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('v1').setLabel(`Vencer Dupla ${d1.id}`).setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('v2').setLabel(`Vencer Dupla ${d2.id}`).setStyle(ButtonStyle.Danger)
                    );

                    const msgT = await thread.send({ 
                        content: `🏆 <@${criadorId}>, declare o vencedor:\nDupla ${d1.id} (<@${d1.p1}>+<@${d1.p2}>) vs Dupla ${d2.id} (<@${d2.p1}>+<@${d2.p2}>)`, 
                        components: [rowV] 
                    });

                    const sCol = msgT.createMessageComponentCollector();

                    sCol.on('collect', async b => {
                        // 🔐 TRAVA DE CRIADOR
                        if (b.user.id !== criadorId) return b.reply({ content: `❌ Apenas <@${criadorId}> pode declarar vitória!`, ephemeral: true });

                        const vD = b.customId === 'v1' ? d1 : d2;
                        const pD = b.customId === 'v1' ? d2 : d1;
                        const vNome = `${vD.p1n}+${vD.p2n}`;

                        // Atualiza Visu
                        duplas[duplas.indexOf(vD)].vencNome = vNome;

                        // 💾 SALVAMENTO NO RANKING
                        let rData = JSON.parse(fs.readFileSync(RANK_PATH, 'utf8'));
                        [vD.p1, vD.p2].forEach(id => {
                            if(!rData[id]) rData[id] = { simuV: 0, simuP: 0, apV: 0, apP: 0, x1V: 0, x1P: 0 };
                            rData[id].simuV += 1;
                        });
                        [pD.p1, pD.p2].forEach(id => {
                            if(!rData[id]) rData[id] = { simuV: 0, simuP: 0, apV: 0, apP: 0, x1V: 0, x1P: 0 };
                            rData[id].simuP += 1;
                        });
                        fs.writeFileSync(RANK_PATH, JSON.stringify(rData, null, 2));

                        // 📢 ATUALIZAR MENSAGEM FIXA
                        try {
                            const conf = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
                            const ch = await interaction.guild.channels.fetch(conf.channelId);
                            const mF = await ch.messages.fetch(conf.messageId);
                            const top10 = Object.entries(rData).sort((a,b) => b.simuV - a.simuV).slice(0,10);
                            const emb = new EmbedBuilder().setTitle('🏆 RANKING GERAL - ALPHA').setColor('#f1c40f')
                                .setDescription(top10.map((u, i) => `${i+1}º | <@${u}> — **${u.simuV} Vitórias**`).join('\n'));
                            await mF.edit({ embeds: [emb] });
                        } catch (e) { console.log("Ranking fixo offline."); }

                        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('⚔️ BRACKET 2V2 ATUALIZADA').setDescription(desenhar()).setColor('#ffff00')] });
                        await b.update({ content: `🏆 Vitória da Dupla ${vD.id} confirmada!`, components: [] });
                        setTimeout(() => thread.delete().catch(() => {}), 10000);
                    });
                };

                // DISPARA OS CONFRONTOS
                for(let i=0; i<duplas.length; i+=2) {
                    if (duplas[i+1]) iniciarMatch(duplas[i], duplas[i+1], i);
                }

            } else if (reason === 'time') {
                await interaction.editReply({ content: '❌ Simu expirado.', embeds: [], components: [] });
            }
        });
    }
};
