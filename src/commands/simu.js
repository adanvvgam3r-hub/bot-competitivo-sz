const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simu')
        .setDescription('Inicia um simulador de Stumble Guys (Versão Teste)')
        .addStringOption(opt => opt.setName('modo').setDescription('1v1 ou 2v2').setRequired(true).addChoices({name:'1v1',value:'1v1'},{name:'2v2',value:'2v2'}))
        .addStringOption(opt => opt.setName('versao').setDescription('Ex: guys, beast ou priv').setRequired(true))
        .addIntegerOption(opt => opt.setName('vagas').setDescription('Quantidade de vagas').setRequired(true).addChoices(
            {name:'2 (TESTE)', value:2},
            {name:'4', value:4},
            {name:'8', value:8},
            {name:'16', value:16}
        ))
        .addStringOption(opt => opt.setName('mapa').setDescription('Mapa da partida').setRequired(true))
        .addIntegerOption(opt => opt.setName('expira').setDescription('Minutos para expirar').setRequired(true)),

    async execute(interaction) {
        const ID_CARGO_ORGANIZADOR = '1453126709447754010';
        const ID_CARGO_ADVERTENCIA = '1467222875399393421';

        if (interaction.member.roles.cache.has(ID_CARGO_ADVERTENCIA)) return interaction.reply({ content: '❌ Você possui uma **Advertência**!', ephemeral: true });
        if (!interaction.member.roles.cache.has(ID_CARGO_ORGANIZADOR) && interaction.user.id !== interaction.guild.ownerId) return interaction.reply({ content: '❌ Apenas Staff!', ephemeral: true });

        const modo = interaction.options.getString('modo');
        const versao = interaction.options.getString('versao');
        const vagas = interaction.options.getInteger('vagas');
        const mapa = interaction.options.getString('mapa').toUpperCase();
        const expiraMinutos = interaction.options.getInteger('expira');
        
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
                embed.setFooter({ text: `Progresso: (${inscritos.length}/${vagas}) alpha • Organizado por ${interaction.user.username}` });
            }
            return embed;
        };

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('inscrever').setLabel('INSCREVER-SE').setStyle(ButtonStyle.Primary)
        );

        const response = await interaction.reply({ embeds: [gerarEmbed()], components: [row] });

        const collector = response.createMessageComponentCollector({ 
            componentType: ComponentType.Button, 
            time: expiraMinutos * 60000 
        });

        collector.on('collect', async i => {
            if (inscritos.includes(i.user.id)) return i.reply({ content: 'Já inscrito!', ephemeral: true });
            
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
                await interaction.editReply({ embeds: [gerarEmbed('#ff0000', 'EXPIRADO').addFields({ name: 'STATUS:', value: '❌ Cancelado.', inline: false })], components: [] });
                setTimeout(() => interaction.deleteReply().catch(() => {}), 30000);
            } else if (reason === 'lotado') {
                // 🎲 Lógica de Chaveamento (Embaralhar)
                const shuffle = (array) => array.sort(() => Math.random() - 0.5);
                const jogadores = shuffle([...inscritos]).map(id => interaction.guild.members.cache.get(id)?.displayName || `User_${id.slice(0,4)}`);

                let bracketText = "```\n";
                if (vagas === 2) {
                    bracketText += `${jogadores[0]} ─┐\n         ├─ 🏆 AGUARDANDO\n${jogadores[1]} ─┘\n`;
                } else if (vagas === 4) {
                    bracketText += `${jogadores[0]} ─┐\n         ├─ Venc A ─┐\n${jogadores[1]} ─┘         │\n                  ├─ 🏆 CAMPEÃO\n${jogadores[2]} ─┐         │\n         ├─ Venc B ─┘\n${jogadores[3]} ─┘\n`;
                }
                bracketText += "```";

                const embedChave = new EmbedBuilder()
                    .setTitle(`⚔️ CHAVEAMENTO - SIMU ${modo}`)
                    .setColor('#00ff00')
                    .setDescription(`**PARTIDAS GERADAS:**\n${bracketText}`)
                    .setFooter({ text: "Boa sorte aos competidores!" });

                await interaction.editReply({ embeds: [embedChave], components: [] });
            }
        });
    }
};
