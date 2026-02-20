const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChannelType, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simu')
        .setDescription('Inicia um simulador de Stumble Guys')
        .addStringOption(opt => opt.setName('modo').setDescription('1v1 ou 2v2').setRequired(true).addChoices({name:'1v1',value:'1v1'},{name:'2v2',value:'2v2'}))
        .addStringOption(opt => opt.setName('versao').setDescription('Ex: guys, beast ou priv').setRequired(true))
        .addIntegerOption(opt => opt.setName('vagas').setDescription('Quantidade de vagas').setRequired(true).addChoices({name:'2 (TESTE)', value:2},{name:'4',value:4},{name:'8',value:8}))
        .addStringOption(opt => opt.setName('mapa').setDescription('Mapa da partida').setRequired(true))
        .addIntegerOption(opt => opt.setName('expira').setDescription('Minutos para expirar').setRequired(true)),

    async execute(interaction) {
        const ID_CARGO_STAFF = '1453126709447754010';
        const ID_CARGO_ADV = '1467222875399393421';

        // 🛡️ TRAVAS DE SEGURANÇA
        if (interaction.member.roles.cache.has(ID_CARGO_ADV)) {
            return interaction.reply({ content: '❌ Você possui uma **Advertência** e está impedido de agir!', ephemeral: true });
        }
        if (!interaction.member.roles.cache.has(ID_CARGO_STAFF) && interaction.user.id !== interaction.guild.ownerId) {
            return interaction.reply({ content: '❌ Apenas quem tem o cargo **Organizar copa** pode usar este comando!', ephemeral: true });
        }

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
                embed.setFooter({ text: `Progresso: (${inscritos.length}/${vagas}) alpha • Por ${interaction.user.username}` });
            } else {
                embed.addFields({ name: 'STATUS:', value: '❌ O tempo acabou e o simulador foi cancelado.', inline: false });
            }
            return embed;
        };

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('inscrever').setLabel('INSCREVER-SE').setStyle(ButtonStyle.Primary)
        );

        const response = await interaction.reply({ embeds: [gerarEmbed()], components: [row] });

        const collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: expiraMin * 60000 
        });

        collector.on('collect', async i => {
            if (expirado) return i.reply({ content: '❌ Este simulador já expirou!', ephemeral: true });
            if (inscritos.includes(i.user.id)) return i.reply({ content: 'Você já está inscrito!', ephemeral: true });
            
            inscritos.push(i.user.id);
            
            if (inscritos.length === vagas) {
                collector.stop('lotado');
            } else {
                await i.update({ embeds: [gerarEmbed()] });
            }
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'time') {
                expirado = true;
                await interaction.editReply({ embeds: [gerarEmbed('#ff0000', 'EXPIRADO')], components: [] });
                setTimeout(() => interaction.deleteReply().catch(() => {}), 30000);

            } else if (reason === 'lotado') {
                const numConfrontos = inscritos.length / 2;
                if (numConfrontos > 12) return interaction.followUp('⚠️ Erro: Limite de 12 confrontos excedido por segurança.');

                await interaction.editReply({ 
                    embeds: [gerarEmbed('#00ff00', 'LOTADO')], 
                    components: [] 
                });

                // 🎲 GERAR TÓPICOS DE CONFRONTO
                for (let i = 0; i < inscritos.length; i += 2) {
                    const p1 = inscritos[i];
                    const p2 = inscritos[i + 1];
                    const cod = Math.floor(1000 + Math.random() * 9000);

                    const thread = await interaction.channel.threads.create({
                        name: `SimuCH-${cod}`,
                        autoArchiveDuration: 60,
                        type: ChannelType.PrivateThread,
                    });

                    await thread.members.add(p1);
                    await thread.members.add(p2);

                    const embedConfronto = new EmbedBuilder()
                        .setTitle(`⚔️ CONFRONTO SimuCH-${cod}`)
                        .setDescription(`Jogadores: <@${p1}> vs <@${p2}>\n\n**Aguardando Staff declarar vencedor.**`)
                        .setColor('#ffaa00');

                    const botoesVitoria = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`v_${p1}`).setLabel(`Vencedor: P1`).setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId(`v_${p2}`).setLabel(`Vencedor: P2`).setStyle(ButtonStyle.Success)
                    );

                    const msgThread = await thread.send({ content: `<@${p1}> <@${p2}>`, embeds: [embedConfronto], components: [botoesVitoria] });

                    const staffCollector = msgThread.createMessageComponentCollector({ componentType: ComponentType.Button });

                    staffCollector.on('collect', async btn => {
                        if (!btn.member.roles.cache.has(ID_CARGO_STAFF)) {
                            return btn.reply({ content: '❌ Apenas Staff pode declarar vitória!', ephemeral: true });
                        }
                        const vencedorId = btn.customId.replace('v_', '');
                        await btn.update({ content: `🏆 Vitória confirmada para: <@${vencedorId}>`, embeds: [], components: [] });
                        
                        setTimeout(() => thread.delete().catch(() => {}), 60000);
                    });
                }
            }
        });
    }
};
