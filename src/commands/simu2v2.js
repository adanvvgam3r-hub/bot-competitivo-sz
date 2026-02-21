const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChannelType, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simu2v2')
        .setDescription('🏆 Sistema de Simulador 2v2 com Grade e Chaveamento')
        .addStringOption(o => o.setName('versao').setDescription('Ex: guys, beast ou priv').setRequired(true))
        .addIntegerOption(o => o.setName('vagas').setDescription('Total de jogadores').setRequired(true).addChoices(
            {name: '4 Jogadores (2 duplas)', value: 4},
            {name: '8 Jogadores (4 duplas)', value: 8},
            {name: '12 Jogadores (6 duplas)', value: 12},
            {name: '16 Jogadores (8 duplas)', value: 16}
        ))
        .addStringOption(o => o.setName('mapa').setDescription('Mapa da partida').setRequired(true))
        .addIntegerOption(o => o.setName('expira').setDescription('Minutos para expirar').setRequired(true)),

    async execute(interaction) {
        const ID_STAFF = '1453126709447754010';
        const ID_ADV = '1467222875399393421';
        const ID_CANAL_TOPICOS = '1474560305492394106';
        const RANK_PATH = '/app/data/ranking.json';

        // 🛡️ SEGURANÇA ALPHA
        if (interaction.member.roles.cache.has(ID_ADV)) return interaction.reply({ content: '❌ Você possui uma **Advertência** ativa.', ephemeral: true });
        if (!interaction.member.roles.cache.has(ID_STAFF) && interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ content: '❌ Apenas quem tem o cargo **Organizar copa** pode iniciar.', ephemeral: true });
        }

        const v = interaction.options.getString('versao');
        const vagas = interaction.options.getInteger('vagas');
        const mapa = interaction.options.getString('mapa').toUpperCase();
        const expira = interaction.options.getInteger('expira');

        // 🗂️ INICIALIZAÇÃO DA GRADE
        let duplas = [];
        for (let i = 0; i < vagas / 2; i++) {
            duplas.push({ id: i + 1, p1: null, p1nome: null, p2: null, p2nome: null, vencNome: null });
        }

        const gerarGradeEmbed = (cor = '#0099ff', status = '🟢 SELEÇÃO DE TIMES') => {
            const embed = new EmbedBuilder()
                .setTitle(`🏆 SIMULADOR 2V2 - ${status}`)
                .setColor(cor)
                .setDescription(`**MAPA:** \`${mapa}\` | **VERSÃO:** \`${v.toUpperCase()}\``)
                .setTimestamp();

            duplas.forEach(d => {
                const j1 = d.p1 ? `<@${d.p1}>` : '*Vazio*';
                const j2 = d.p2 ? `<@${d.p2}>` : '*Vazio*';
                embed.addFields({ name: `👥 DUPLA ${d.id}`, value: `**A:** ${j1}\n**B:** ${j2}`, inline: true });
            });

            embed.setFooter({ text: `alpha • Vagas: ${vagas} | Expira em ${expira}min` });
            return embed;
        };

        // ⌨️ GERADOR DE BOTÕES DINÂMICO (Máx 5 por linha)
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

        const response = await interaction.reply({ embeds: [gerarGradeEmbed()], components: gerarBotoes() });
        const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: expira * 60000 });

        collector.on('collect', async i => {
            const todosIds = duplas.flatMap(d => [d.p1, d.p2]);
            if (todosIds.includes(i.user.id)) return i.reply({ content: '❌ Você já escolheu um slot!', ephemeral: true });

            const [, dIdx, slot] = i.customId.split('_');
            duplas[dIdx][slot] = i.user.id;
            duplas[dIdx][slot + 'nome'] = i.user.username;

            const total = duplas.flatMap(d => [d.p1, d.p2]).filter(id => id !== null).length;

            if (total === vagas) collector.stop('lotado');
            else await i.update({ embeds: [gerarGradeEmbed()], components: gerarBotoes() });
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'lotado') {
                await interaction.editReply({ content: '✅ Grade completa! Criando tópicos...', components: [], embeds: [gerarGradeEmbed('#00ff00', 'GRADE FECHADA')] });

                const canal = interaction.guild.channels.cache.get(ID_CANAL_TOPICOS);
                if (!canal) return interaction.followUp('❌ Canal de tópicos não encontrado.');

                // 🏁 GERAÇÃO DOS CONFRONTOS (D1 vs D2, D3 vs D4...)
                for (let i = 0; i < duplas.length; i += 2) {
                    const d1 = duplas[i];
                    const d2 = duplas[i+1];
                    if (!d2) break;

                    const thread = await canal.threads.create({ 
                        name: `Simu2v2-D${d1.id}-vs-D${d2.id}`, 
                        type: ChannelType.PrivateThread 
                    });

                    [d1.p1, d1.p2, d2.p1, d2.p2].forEach(id => thread.members.add(id));

                    const embedWar = new EmbedBuilder()
                        .setTitle(`⚔️ CONFRONTO SimuCH-${Math.floor(Math.random()*999)}`)
                        .setColor('#ffaa00')
                        .addFields(
                            { name: `🔵 DUPLA ${d1.id}`, value: `<@${d1.p1}> & <@${d1.p2}>`, inline: true },
                            { name: `🔴 DUPLA ${d2.id}`, value: `<@${d2.p1}> & <@${d2.p2}>`, inline: true }
                        );

                    const rowV = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('v1').setLabel(`Vencer Dupla ${d1.id}`).setStyle(ButtonStyle.Primary),
                        new ButtonBuilder().setCustomId('v2').setLabel(`Vencer Dupla ${d2.id}`).setStyle(ButtonStyle.Danger)
                    );

                    const msgT = await thread.send({ content: `Staff <@&${ID_STAFF}>, aguardando resultado.`, embeds: [embedWar], components: [rowV] });
                    const sCol = msgT.createMessageComponentCollector();

                    sCol.on('collect', async b => {
                        if (!b.member.roles.cache.has(ID_STAFF)) return b.reply({ content: '❌ Apenas Staff!', ephemeral: true });

                        const vD = b.customId === 'v1' ? d1 : d2;
                        const pD = b.customId === 'v1' ? d2 : d1;
                        
                        // Atualiza Dados Visuais
                        duplas[duplas.indexOf(vD)].vencNome = `${vD.p1nome}+${vD.p2nome}`;

                        // 📈 SALVAMENTO RANKING (VOLUME)
                        let r = JSON.parse(fs.readFileSync(RANK_PATH, 'utf8'));
                        [vD.p1, vD.p2].forEach(id => {
                            if(!r[id]) r[id] = { simuV: 0, simuP: 0, apV: 0, apP: 0, x1V: 0, x1P: 0 };
                            r[id].simuV += 1;
                        });
                        [pD.p1, pD.p2].forEach(id => {
                            if(!r[id]) r[id] = { simuV: 0, simuP: 0, apV: 0, apP: 0, x1V: 0, x1P: 0 };
                            r[id].simuP += 1;
                        });
                        fs.writeFileSync(RANK_PATH, JSON.stringify(r, null, 2));

                        // 📊 ATUALIZA BRACKET FINAL
                        const drawFinal = "```md\n# 🏁 RESULTADO 2V2\n" + (b.customId === 'v1' ? `>${d1.p1nome}+${d1.p2nome}< vs ${d2.p1nome}+${d2.p2nome}` : `${d1.p1nome}+${d1.p2nome} vs >${d2.p1nome}+${d2.p2nome}<`) + "\n```";
                        await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🏆 RESULTADOS ATUALIZADOS').setDescription(drawFinal).setColor('#ffff00')] });

                        await b.update({ content: `🏆 Vitória declarada para Dupla ${vD.id}!`, components: [], embeds: [] });
                        setTimeout(() => thread.delete().catch(() => {}), 15000);
                    });
                }
            } else if (reason === 'time') {
                await interaction.editReply({ content: '❌ Simu expirado.', embeds: [], components: [] });
                setTimeout(() => interaction.deleteReply().catch(() => {}), 10000);
            }
        });
    }
};
