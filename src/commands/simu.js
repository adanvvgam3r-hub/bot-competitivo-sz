const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simu')
        .setDescription('Inicia um simulador com tópicos em canal específico')
        .addStringOption(opt => opt.setName('modo').setDescription('1v1 ou 2v2').setRequired(true).addChoices({name:'1v1',value:'1v1'},{name:'2v2',value:'2v2'}))
        .addStringOption(opt => opt.setName('versao').setDescription('Ex: guys, beast ou priv').setRequired(true))
        .addIntegerOption(opt => opt.setName('vagas').setDescription('Vagas').setRequired(true).addChoices({name:'2 (TESTE)', value:2},{name:'4',value:4},{name:'8',value:8}))
        .addStringOption(opt => opt.setName('mapa').setDescription('Mapa da partida').setRequired(true))
        .addIntegerOption(opt => opt.setName('expira').setDescription('Minutos para expirar').setRequired(true)),

    async execute(interaction) {
        const ID_CARGO_STAFF = '1453126709447754010';
        const ID_CARGO_ADV = '1467222875399393421';
        const ID_CANAL_CONFRONTOS = '1474560305492394106'; // O canal que você especificou

        if (interaction.member.roles.cache.has(ID_CARGO_ADV)) return interaction.reply({ content: '❌ Você possui uma **Advertência**!', ephemeral: true });
        if (!interaction.member.roles.cache.has(ID_CARGO_STAFF) && interaction.user.id !== interaction.guild.ownerId) return interaction.reply({ content: '❌ Apenas Staff!', ephemeral: true });

        const modo = interaction.options.getString('modo');
        const versao = interaction.options.getString('versao');
        const vagas = interaction.options.getInteger('vagas');
        const mapa = interaction.options.getString('mapa').toUpperCase();
        const expiraMin = interaction.options.getInteger('expira');
        
        let inscritos = [];
        let expirado = false;

        const gerarEmbed = (cor = '#8b00ff', status = '🟢 INSCRIÇÕES ABERTAS') => {
            const embed = new EmbedBuilder()
                .setTitle(`🏆 SIMULADOR ${modo} - ${status}`)
                .setColor(cor)
                .addFields(
                    { name: 'MAPA:', value: mapa, inline: true },
                    { name: 'VERSÃO:', value: versao.toUpperCase(), inline: true },
                    { name: 'VAGAS:', value: `${vagas}`, inline: true }
                );
            if (!expirado) {
                embed.addFields({ name: 'INSCRITOS:', value: inscritos.length > 0 ? inscritos.map(id => `<@${id}>`).join(', ') : 'Ninguém ainda', inline: false });
                embed.setFooter({ text: `Progresso: (${inscritos.length}/${vagas}) alpha` });
            }
            return embed;
        };

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
            if (reason === 'time') {
                expirado = true;
                await interaction.editReply({ embeds: [gerarEmbed('#ff0000', 'EXPIRADO')], components: [] });
                setTimeout(() => interaction.deleteReply().catch(() => {}), 30000);
            } else if (reason === 'lotado') {
                const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);
                const p = shuffle([...inscritos]).map(id => interaction.guild.members.cache.get(id)?.displayName.slice(0, 8) || `User_${id.slice(0,3)}`);
                
                let bracket = "```\n";
                if (vagas === 2) bracket += `${p[0]} ─┐\n         ├─ 🏆 FINAL\n${p[1]} ─┘\n`;
                else if (vagas === 4) bracket += `${p[0]} ─┐\n         ├─ Venc A ─┐\n${p[1]} ─┘         │\n                  ├─ 🏆 CAMPEÃO\n${p[2]} ─┐         │\n         ├─ Venc B ─┘\n${p[3]} ─┘\n`;
                bracket += "```";

                await interaction.editReply({ embeds: [new EmbedBuilder().setTitle(`⚔️ CHAVEAMENTO - ${modo}`).setColor('#00ff00').setDescription(bracket)], components: [] });

                // --- BUSCAR CANAL ESPECÍFICO ---
                const canalConfrontos = interaction.guild.channels.cache.get(ID_CANAL_CONFRONTOS);
                if (!canalConfrontos) return interaction.followUp({ content: '⚠️ Erro: Canal de confrontos não encontrado!', ephemeral: true });

                for (let i = 0; i < inscritos.length; i += 2) {
                    const p1 = inscritos[i];
                    const p2 = inscritos[i+1];
                    const cod = Math.floor(1000 + Math.random() * 9000);

                    try {
                        const thread = await canalConfrontos.threads.create({
                            name: `SimuCH-${cod}`,
                            type: ChannelType.PrivateThread, // Requer Boost Nível 2 ou Permissão Admin no Bot
                            reason: 'Duelo Simu',
                        });

                        await thread.members.add(p1);
                        await thread.members.add(p2);

                        const rowVenc = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`v_${p1}`).setLabel(`Vencer P1`).setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId(`v_${p2}`).setLabel(`Vencer P2`).setStyle(ButtonStyle.Success)
                        );

                        const msg = await thread.send({ content: `⚔️ **CONFRONTO**\n<@${p1}> vs <@${p2}>`, components: [rowVenc] });
                        const staffCol = msg.createMessageComponentCollector({ componentType: ComponentType.Button });

                        staffCol.on('collect', async b => {
                            if (!b.member.roles.cache.has(ID_CARGO_STAFF)) return b.reply({ content: '❌ Apenas Staff!', ephemeral: true });
                            await b.update({ content: `🏆 Vitória: <@${b.customId.replace('v_', '')}>`, components: [] });
                            setTimeout(() => thread.delete().catch(() => {}), 60000);
                        });
                    } catch (e) {
                        console.error(e);
                        interaction.followUp({ content: '❌ Falha ao criar tópico. Verifique se o Bot é **Administrador** ou se o canal tem **Boost Nível 2**.', ephemeral: true });
                        break;
                    }
                }
            }
        });
    }
};
