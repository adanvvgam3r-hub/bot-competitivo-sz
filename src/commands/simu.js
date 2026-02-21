const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChannelType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simu')
        .setDescription('Simulador com Bracket Automática')
        .addStringOption(opt => opt.setName('modo').setDescription('1v1 ou 2v2').setRequired(true).addChoices({name:'1v1',value:'1v1'},{name:'2v2',value:'2v2'}))
        .addStringOption(opt => opt.setName('versao').setDescription('Ex: guys, beast ou priv').setRequired(true))
        .addIntegerOption(opt => opt.setName('vagas').setDescription('Vagas').setRequired(true).addChoices({name:'2 (TESTE)', value:2},{name:'4',value:4},{name:'8',value:8}))
        .addStringOption(opt => opt.setName('mapa').setDescription('Mapa').setRequired(true))
        .addIntegerOption(opt => opt.setName('expira').setDescription('Minutos para expirar').setRequired(true)),

    async execute(interaction) {
        const ID_CARGO_STAFF = '1453126709447754010';
        const ID_CANAL_CONFRONTOS = '1474560305492394106';

        const modo = interaction.options.getString('modo');
        const vagas = interaction.options.getInteger('vagas');
        const expiraMin = interaction.options.getInteger('expira');
        const mapa = interaction.options.getString('mapa').toUpperCase();
        let inscritos = [];

        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('inscrever').setLabel('INSCREVER-SE').setStyle(ButtonStyle.Primary));
        const response = await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`🏆 SIMULADOR ${modo}`).setColor('#8b00ff').setFooter({text: `alpha (0/${vagas})`})], components: [row] });

        const collector = response.createMessageComponentCollector({ componentType: ComponentType.Button, time: expiraMin * 60000 });

        collector.on('collect', async i => {
            if (inscritos.includes(i.user.id)) return i.reply({ content: 'Já inscrito!', ephemeral: true });
            inscritos.push(i.user.id);
            if (inscritos.length === vagas) collector.stop('lotado');
            else await i.update({ embeds: [new EmbedBuilder().setTitle(`🏆 SIMULADOR`).setColor('#8b00ff').setFooter({text: `alpha (${inscritos.length}/${vagas})`})] });
        });

        collector.on('end', async (collected, reason) => {
            if (reason === 'lotado') {
                const shuffle = (arr) => arr.sort(() => Math.random() - 0.5);
                const p = shuffle([...inscritos]).map(id => interaction.guild.members.cache.get(id)?.displayName.slice(0, 8) || `User_${id.slice(0,3)}`);
                
                // Estrutura inicial da Bracket
                let bracketData = { p: p, v: ["Venc A", "Venc B", "Venc C", "Venc D", "Venc E", "Venc F", "CAMPEÃO"] };

                const desenharBracket = (data) => {
                    let b = "```\n";
                    if (vagas === 2) b += `${data.p[0]} ─┐\n         ├─ ${data.v[6]}\n${data.p[1]} ─┘\n`;
                    else if (vagas === 4) b += `${data.p[0]} ─┐\n         ├─ ${data.v[0]} ─┐\n${data.p[1]} ─┘         │\n                  ├─ ${data.v[6]}\n${data.p[2]} ─┐         │\n         ├─ ${data.v[1]} ─┘\n${data.p[3]} ─┘\n`;
                    return b + "```";
                };

                const msgBracket = await interaction.editReply({ 
                    embeds: [new EmbedBuilder().setTitle(`⚔️ BRACKET AO VIVO`).setColor('#00ff00').setDescription(desenharBracket(bracketData))], 
                    components: [] 
                });

                const canalConfrontos = interaction.guild.channels.cache.get(ID_CANAL_CONFRONTOS);

                for (let i = 0; i < inscritos.length; i += 2) {
                    const idx = i / 2; // Índice do confronto (0, 1, 2...)
                    const p1 = inscritos[i];
                    const p2 = inscritos[i+1];

                    const thread = await canalConfrontos.threads.create({ name: `SimuCH-${Math.floor(1000+Math.random()*9000)}`, type: ChannelType.PrivateThread });
                    await thread.members.add(p1); await thread.members.add(p2);

                    const rowVenc = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId(`v_${p1}_${idx}`).setLabel(`Vencer P1`).setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId(`v_${p2}_${idx}`).setLabel(`Vencer P2`).setStyle(ButtonStyle.Success)
                    );

                    const msg = await thread.send({ content: `⚔️ **CONFRONTO**\n<@${p1}> vs <@${p2}>`, components: [rowVenc] });
                    const staffCol = msg.createMessageComponentCollector({ componentType: ComponentType.Button });

                    staffCol.on('collect', async b => {
                        if (!b.member.roles.cache.has(ID_CARGO_STAFF)) return b.reply({ content: 'Apenas Staff!', ephemeral: true });
                        
                        const args = b.customId.split('_');
                        const vencedorId = args[1];
                        const confrontoIdx = parseInt(args[2]);
                        const nomeVencedor = interaction.guild.members.cache.get(vencedorId)?.displayName.slice(0, 8) || "Ganhador";

                        // Atualiza o dado da bracket e edita a mensagem principal
                        bracketData.v[confrontoIdx] = nomeVencedor;
                        if (vagas === 2) bracketData.v[6] = `🏆 ${nomeVencedor}`; 

                        await interaction.editReply({ 
                            embeds: [new EmbedBuilder().setTitle(`⚔️ BRACKET ATUALIZADA`).setColor('#ffff00').setDescription(desenharBracket(bracketData))] 
                        });

                        await b.update({ content: `🏆 Vitória: <@${vencedorId}>`, components: [] });
                        setTimeout(() => thread.delete().catch(() => {}), 10000);
                    });
                }
            }
        });
    }
};
