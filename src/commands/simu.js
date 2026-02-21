const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simu')
        .setDescription('Simulador com Bracket e Tópicos')
        .addStringOption(opt => opt.setName('modo').setDescription('1v1 ou 2v2').setRequired(true).addChoices({name:'1v1',value:'1v1'},{name:'2v2',value:'2v2'}))
        .addStringOption(opt => opt.setName('versao').setDescription('Ex: guys, beast ou priv').setRequired(true))
        .addIntegerOption(opt => opt.setName('vagas').setDescription('Vagas').setRequired(true).addChoices({name:'2 (TESTE)', value:2},{name:'4',value:4},{name:'8',value:8}))
        .addStringOption(opt => opt.setName('mapa').setDescription('Mapa').setRequired(true))
        .addIntegerOption(opt => opt.setName('expira').setDescription('Minutos para expirar').setRequired(true)),

    async execute(interaction) {
        const ID_CARGO_STAFF = '1453126709447754010';
        const ID_CARGO_ADV = '1467222875399393421';

        if (interaction.member.roles.cache.has(ID_CARGO_ADV)) return interaction.reply({ content: '❌ Você tem advertência!', ephemeral: true });
        if (!interaction.member.roles.cache.has(ID_CARGO_STAFF) && interaction.user.id !== interaction.guild.ownerId) return interaction.reply({ content: '❌ Sem permissão!', ephemeral: true });

        const modo = interaction.options.getString('modo');
        const vagas = interaction.options.getInteger('vagas');
        const expiraMin = interaction.options.getInteger('expira');
        const mapa = interaction.options.getString('mapa').toUpperCase();
        let inscritos = [];

        const gerarEmbed = (cor = '#8b00ff', status = '🟢 ABERTO') => new EmbedBuilder()
            .setTitle(`🏆 SIMULADOR ${modo} - ${status}`)
            .setColor(cor)
            .addFields(
                { name: 'MAPA:', value: mapa, inline: true },
                { name: 'INSCRITOS:', value: inscritos.length > 0 ? inscritos.map(id => `<@${id}>`).join(', ') : 'Vazio', inline: false }
            )
            .setFooter({ text: `Progresso: (${inscritos.length}/${vagas}) alpha` });

        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('inscrever').setLabel('INSCREVER-SE').setStyle(ButtonStyle.Primary));
        const response = await interaction.reply({ embeds: [gerarEmbed()], components: [row] });

        const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: expiraMin * 60000 });

        collector.on('collect', async i => {
            if (inscritos.includes(i.user.id)) return i.reply({ content: 'Já inscrito!', ephemeral: true });
            inscritos.push(i.user.id);
            if (inscritos.length === vagas) collector.stop('lotado');
            else await i.update({ embeds: [gerarEmbed()] });
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'lotado') {
                // 1. GERAR BRACKET (VISUAL)
                const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);
                const players = shuffle([...inscritos]).map(id => interaction.guild.members.cache.get(id)?.displayName || `User_${id.slice(0,3)}`);
                
                let bracket = "```\n";
                if (vagas === 2) bracket += `${players[0]} ─┐\n         ├─ 🏆 AGUARDANDO\n${players[1]} ─┘\n`;
                else if (vagas === 4) bracket += `${players[0]} ─┐\n         ├─ Venc A ─┐\n${players[1]} ─┘         │\n                  ├─ 🏆 FINAL\n${players[2]} ─┐         │\n         ├─ Venc B ─┘\n${players[3]} ─┘\n`;
                bracket += "```";

                const embedChave = new EmbedBuilder()
                    .setTitle(`⚔️ CHAVEAMENTO GERADO`)
                    .setColor('#00ff00')
                    .setDescription(bracket);

                await interaction.editReply({ embeds: [embedChave], components: [] });

                // 2. TENTAR CRIAR TÓPICOS (COM SEGURANÇA)
                for (let i = 0; i < inscritos.length; i += 2) {
                    const p1 = inscritos[i];
                    const p2 = inscritos[i+1];
                    const cod = Math.floor(1000 + Math.random() * 9000);

                    try {
                        const thread = await interaction.channel.threads.create({
                            name: `SimuCH-${cod}`,
                            type: ChannelType.PrivateThread,
                            reason: 'Duelo Simu',
                        });

                        await thread.members.add(p1);
                        await thread.members.add(p2);

                        const btnVenc = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`v_${p1}`).setLabel(`Vencer P1`).setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId(`v_${p2}`).setLabel(`Vencer P2`).setStyle(ButtonStyle.Success)
                        );

                        const msg = await thread.send({ content: `<@${p1}> vs <@${p2}>`, components: [btnVenc] });
                        
                        const staffCol = msg.createMessageComponentCollector({ componentType: ComponentType.Button });
                        staffCol.on('collect', async b => {
                            if (!b.member.roles.cache.has(ID_CARGO_STAFF)) return b.reply({ content: 'Apenas Staff!', ephemeral: true });
                            await b.update({ content: `🏆 Vencedor: <@${b.customId.replace('v_', '')}>`, components: [] });
                            setTimeout(() => thread.delete().catch(() => {}), 60000);
                        });
                    } catch (err) {
                        console.log("Erro ao criar tópico: Verifique as permissões do bot!");
                        interaction.followUp({ content: "⚠️ Não consegui criar os tópicos. Verifique se tenho a permissão **Criar Tópicos Privados**!", ephemeral: true });
                        break;
                    }
                }
            } else if (reason === 'time') {
                await interaction.editReply({ embeds: [gerarEmbed('#ff0000', 'EXPIRADO')], components: [] });
                setTimeout(() => interaction.deleteReply().catch(() => {}), 30000);
            }
        });
    }
};
