const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simu')
        .setDescription('Inicia um simulador de Stumble Guys')
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

        const vagas = interaction.options.getInteger('vagas');
        const expiraMin = interaction.options.getInteger('expira');
        let inscritos = [];

        // --- LÓGICA DE INSCRIÇÃO (IGUAL ANTERIOR) ---
        const embed = new EmbedBuilder().setTitle(`🏆 SIMULADOR`).setColor('#8b00ff').setFooter({ text: `alpha (${inscritos.length}/${vagas})` });
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('inscrever').setLabel('INSCREVER').setStyle(ButtonStyle.Primary));
        const response = await interaction.reply({ embeds: [embed], components: [row] });

        const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: expiraMin * 60000 });

        collector.on('collect', async i => {
            if (inscritos.includes(i.user.id)) return i.reply({ content: 'Já inscrito!', ephemeral: true });
            inscritos.push(i.user.id);
            if (inscritos.length === vagas) collector.stop('lotado');
            else await i.update({ embeds: [new EmbedBuilder().setTitle(`🏆 SIMULADOR`).setColor('#8b00ff').setFooter({ text: `alpha (${inscritos.length}/${vagas})` })] });
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'lotado') {
                // 🛡️ SEGURANÇA: Trava de 12 canais/tópicos
                const numConfrontos = inscritos.length / 2;
                if (numConfrontos > 12) return interaction.followUp('❌ Segurança: Limite de 12 confrontos excedido.');

                await interaction.editReply({ content: '✅ Lotado! Criando tópicos de confronto...', components: [] });

                // Gerar Confrontos
                for (let i = 0; i < inscritos.length; i += 2) {
                    const p1 = inscritos[i];
                    const p2 = inscritos[i + 1];
                    const cod = Math.floor(1000 + Math.random() * 9000);

                    // Criar Tópico no canal atual
                    const thread = await interaction.channel.threads.create({
                        name: `SimuCH-${cod}`,
                        autoArchiveDuration: 60,
                        type: ChannelType.PrivateThread,
                        reason: 'Confronto de simulador',
                    });

                    await thread.members.add(p1);
                    await thread.members.add(p2);

                    const embedConfronto = new EmbedBuilder()
                        .setTitle(`⚔️ CONFRONTO SimuCH-${cod}`)
                        .setDescription(`Jogadores: <@${p1}> vs <@${p2}>\n\n**Aguardando Staff declarar vencedor.**`)
                        .setColor('#ffaa00');

                    const botoesVitoria = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`venc_${p1}_${cod}`).setLabel(`Vencedor: ${p1.slice(0,5)}`).setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId(`venc_${p2}_${cod}`).setLabel(`Vencedor: ${p2.slice(0,5)}`).setStyle(ButtonStyle.Success)
                    );

                    const msgThread = await thread.send({ embeds: [embedConfronto], components: [botoesVitoria] });

                    // Coletor para a Staff declarar vencedor
                    const staffCollector = msgThread.createMessageComponentCollector({ componentType: ComponentType.Button });

                    staffCollector.on('collect', async btn => {
                        if (!btn.member.roles.cache.has(ID_CARGO_STAFF)) {
                            return btn.reply({ content: '❌ Apenas Staff (Organizar copa) pode declarar o vencedor!', ephemeral: true });
                        }

                        const ganhadorId = btn.customId.split('_')[1];
                        await btn.update({ content: `🏆 Vencedor declarado: <@${ganhadorId}>`, embeds: [], components: [] });
                        
                        // Aqui você chamaria a função de atualizar a bracket global
                        console.log(`SimuCH-${cod} finalizado. Vencedor: ${ganhadorId}`);
                        
                        // Opcional: Deletar tópico após 1 min do fim
                        setTimeout(() => thread.delete().catch(() => {}), 60000);
                    });
                }
            }
        });
    }
};
