const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChannelType, StringSelectMenuBuilder } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simu')
        .setDescription('Simulador Alpha com Escolha de Times 2v2')
        .addStringOption(o => o.setName('modo').setDescription('1v1 ou 2v2').setRequired(true).addChoices({name:'1v1',value:'1v1'},{name:'2v2',value:'2v2'}))
        .addStringOption(o => o.setName('versao').setDescription('Ex: guys, beast ou priv').setRequired(true))
        .addIntegerOption(o => o.setName('vagas').setDescription('Vagas (Jogadores no 1v1 ou Duplas no 2v2)').setRequired(true).addChoices({name:'2', value:2},{name:'4',value:4},{name:'8',value:8}))
        .addStringOption(o => o.setName('mapa').setDescription('Mapa da partida').setRequired(true))
        .addIntegerOption(o => o.setName('expira').setDescription('Minutos para expirar').setRequired(true)),

    async execute(interaction) {
        const ID_STAFF = '1453126709447754010';
        const ID_CANAL_CONFRONTOS = '1474560305492394106';
        const criadorId = interaction.user.id;

        if (!interaction.member.roles.cache.has(ID_STAFF)) return interaction.reply({ content: '❌ Apenas Staff!', ephemeral: true });

        const modo = interaction.options.getString('modo');
        const vagas = interaction.options.getInteger('vagas');
        const expiraMin = interaction.options.getInteger('expira');
        
        let jogadoresSolos = []; // Lista de quem clicou mas não tem dupla
        let timesFormados = []; // [{ p1: id, p2: id }]

        const gerarEmbed = () => {
            let desc = modo === '1v1' ? 
                `**Jogadores:** ${jogadoresSolos.map(id => `<@${id}>`).join(', ') || 'Nenhum'}` :
                `**Duplas:**\n${timesFormados.map(t => `<@${t.p1}> & <@${t.p2}>`).join('\n') || 'Nenhuma'}\n\n**Aguardando parceiro:** ${jogadoresSolos.map(id => `<@${id}>`).join(', ') || 'Ninguém'}`;

            return new EmbedBuilder()
                .setTitle(`🏆 SIMULADOR ${modo}`)
                .setColor('#8b00ff')
                .setDescription(desc)
                .setFooter({ text: `Progresso: (${modo === '1v1' ? jogadoresSolos.length : timesFormados.length}/${vagas}) alpha` });
        };

        const rowBtn = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('inscrever').setLabel('INSCREVER-SE').setStyle(ButtonStyle.Primary)
        );

        const response = await interaction.reply({ embeds: [gerarEmbed()], components: [rowBtn] });
        const collector = response.createMessageComponentCollector({ time: expiraMin * 60000 });

        collector.on('collect', async i => {
            if (i.customId === 'inscrever') {
                if (jogadoresSolos.includes(i.user.id) || timesFormados.some(t => t.p1 === i.user.id || t.p2 === i.user.id)) {
                    return i.reply({ content: 'Você já está na lista!', ephemeral: true });
                }

                if (modo === '1v1') {
                    jogadoresSolos.push(i.user.id);
                    if (jogadoresSolos.length === vagas) collector.stop('lotado');
                    else await i.update({ embeds: [gerarEmbed()] });
                } else {
                    // Lógica 2v2: Escolher parceiro
                    if (jogadoresSolos.length === 0) {
                        jogadoresSolos.push(i.user.id);
                        return i.reply({ content: 'Você entrou na lista de espera. Aguarde alguém para formar dupla!', ephemeral: true });
                    }

                    const menu = new StringSelectMenuBuilder()
                        .setCustomId('escolher_parceiro')
                        .setPlaceholder('Escolha seu parceiro de time')
                        .addOptions(jogadoresSolos.map(id => ({
                            label: interaction.guild.members.cache.get(id)?.displayName || 'Jogador',
                            value: id
                        })));

                    await i.reply({ content: 'Selecione seu parceiro da lista abaixo:', components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
                }
            }

            if (i.customId === 'escolher_parceiro') {
                const p1 = i.user.id;
                const p2 = i.values[0];

                timesFormados.push({ p1, p2 });
                jogadoresSolos = jogadoresSolos.filter(id => id !== p2); // Remove o parceiro da lista de espera

                await i.update({ content: `✅ Dupla formada com <@${p2}>!`, components: [], ephemeral: true });
                await interaction.editReply({ embeds: [gerarEmbed()] });

                if (timesFormados.length === vagas) collector.stop('lotado');
            }
        });

        // --- LÓGICA DE FINALIZAÇÃO E BRACKET (Igual à anterior, mas adaptada para ler timesFormados no 2v2) ---
        // ... (Seu código de Bracket e Tópicos SimuCH aqui)
    }
};
