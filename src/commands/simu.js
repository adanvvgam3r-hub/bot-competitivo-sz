const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChannelType } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simu')
        .setDescription('Simulador Alpha com Escolha de Vagas')
        .addStringOption(o => o.setName('modo').setDescription('1v1 ou 2v2').setRequired(true).addChoices({name:'1v1',value:'1v1'},{name:'2v2',value:'2v2'}))
        .addStringOption(o => o.setName('versao').setDescription('Ex: guys, beast ou priv').setRequired(true))
        .addIntegerOption(o => o.setName('vagas').setDescription('Total de JOGADORES').setRequired(true).addChoices({name:'2',value:2},{name:'4',value:4},{name:'8',value:8}))
        .addStringOption(o => o.setName('mapa').setDescription('Mapa da partida').setRequired(true))
        .addIntegerOption(o => o.setName('expira').setDescription('Minutos para expirar').setRequired(true)),

    async execute(interaction) {
        const ID_STAFF = '1453126709447754010';
        const ID_CANAL_CONFRONTOS = '1474560305492394106';
        const RANK_PATH = '/app/data/ranking.json';
        const criadorId = interaction.user.id;

        if (!interaction.member.roles.cache.has(ID_STAFF)) return interaction.reply({ content: '❌ Apenas Staff!', ephemeral: true });

        const modo = interaction.options.getString('modo');
        const vagasTotal = interaction.options.getInteger('vagas');
        const expiraMin = interaction.options.getInteger('expira');
        
        // Array fixo com o tamanho das vagas, preenchido com null
        let vagas = new Array(vagasTotal).fill(null);

        const gerarEmbed = (status = '🟢 INSCRIÇÕES ABERTAS', cor = '#8b00ff') => {
            let desc = "**Times:**\n";
            const porTime = modo === '1v1' ? 1 : 2;
            const totalTimes = vagasTotal / porTime;

            for (let i = 1; i <= totalTimes; i++) {
                const f = (i - 1) * porTime;
                const m = vagas.slice(f, f + porTime);
                let linha = m.map(id => id ? `<@${id}>` : 'ninguem ainda').join(' | ');
                desc += `**Time ${i}:** ${linha}\n`;
            }

            return new EmbedBuilder()
                .setTitle(`🏆 SIMULADOR ${modo} - ${status}`)
                .setColor(cor)
                .setDescription(desc)
                .setFooter({ text: `Progresso: (${vagas.filter(v => v !== null).length}/${vagasTotal}) alpha • Por ${interaction.user.username}` });
        };

        const gerarBotoes = () => {
            const rows = [];
            let currentRow = new ActionRowBuilder();
            
            for (let i = 0; i < vagasTotal; i++) {
                const btn = new ButtonBuilder()
                    .setCustomId(`vaga_${i}`)
                    .setLabel(modo === '1v1' ? `Vaga ${i + 1}` : `Time ${Math.floor(i/2) + 1} (${(i%2)+1})`)
                    .setStyle(vagas[i] ? ButtonStyle.Danger : ButtonStyle.Secondary)
                    .setDisabled(vagas[i] !== null);

                currentRow.addComponents(btn);
                if (currentRow.components.length === 4 || i === vagasTotal - 1) {
                    rows.push(currentRow);
                    currentRow = new ActionRowBuilder();
                }
            }
            return rows;
        };

        const response = await interaction.reply({ embeds: [gerarEmbed()], components: gerarBotoes() });
        const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: expiraMin * 60000 });

        collector.on('collect', async i => {
            await i.deferUpdate();

            if (vagas.includes(i.user.id)) return i.followUp({ content: '❌ Você já escolheu uma vaga!', ephemeral: true });
            
            const vagaIdx = parseInt(i.customId.replace('vaga_', ''));
            vagas[vagaIdx] = i.user.id;

            if (vagas.every(v => v !== null)) {
                collector.stop('lotado');
            } else {
                await interaction.editReply({ embeds: [gerarEmbed()], components: gerarBotoes() });
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'lotado') {
                await interaction.editReply({ embeds: [gerarEmbed('✅ PRONTO', '#00ff00')], components: [] });
                
                // Lógica de Bracket (Baseada na ordem das vagas escolhidas)
                const p = vagas.map(id => interaction.guild.members.cache.get(id)?.displayName.slice(0, 8) || 'Player');
                let bData = { p, v: ["Venc A", "Venc B", "Venc C", "CAMPEÃO"] };

                const desenharBracket = (d) => {
                    let b = "```\n";
                    if (vagasTotal === 2 || (modo === '2v2' && vagasTotal === 4)) {
                        b += `${d.p[0]} ─┐\n         ├─ ${d.v[0]}\n${d.p[1]} ─┘\n`;
                    } else {
                        b += `${d.p[0]} ─┐\n     ├─ ${d.v[0]} ─┐\n${d.p[1]} ─┘      │\n            ├─ ${d.v[2]}\n${d.p[2]} ─┐      │\n     ├─ ${d.v[1]} ─┘\n${d.p[3]} ─┘\n`;
                    }
                    return b + "```";
                };

                await interaction.followUp({ embeds: [new EmbedBuilder().setTitle('⚔️ BRACKET GERADA').setDescription(desenharBracket(bData)).setColor('#00ff00')] });

                // Criar Tópicos e Lógica de 2 segundos para Staff
                const canal = interaction.guild.channels.cache.get(ID_CANAL_CONFRONTOS);
                const salto = modo === '1v1' ? 2 : 4;

                for (let i = 0; i < vagas.length; i += salto) {
                    const idx = i / salto;
                    const p1Id = vagas[i];
                    const p2Id = modo === '1v1' ? vagas[i+1] : vagas[i+2];

                    const thread = await canal.threads.create({ name: `SimuCH-${Math.floor(1000+Math.random()*9000)}`, type: ChannelType.PrivateThread });
                    for (let j = i; j < i + salto; j++) { if(vagas[j]) await thread.members.add(vagas[j]); }

                    const btnsV = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`v_${p1Id}_${idx}`).setLabel(`Vencer A`).setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId(`v_${p2Id}_${idx}`).setLabel(`Vencer B`).setStyle(ButtonStyle.Success)
                    );

                    const m = await thread.send({ content: `⚔️ **CONFRONTO**\nApenas <@${criadorId}> declara o vencedor.`, components: [btnsV] });
                    const sCol = m.createMessageComponentCollector();

                    sCol.on('collect', async b => {
                        await b.deferUpdate();
                        if (b.user.id !== criadorId) return b.followUp({ content: 'Apenas criador!', ephemeral: true });

                        // 🕒 AGUARDA 2 SEGUNDOS
                        setTimeout(async () => {
                            const [ , vId, cIdx] = b.customId.split('_');
                            // Lógica de Ranking e Bracket aqui...
                            await b.editReply({ content: `🏆 Vitória confirmada!`, components: [] });
                            setTimeout(() => thread.delete().catch(() => {}), 10000);
                        }, 2000);
                    });
                }
            }
        });
    }
};
