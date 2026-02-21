const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChannelType } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('x1')
        .setDescription('Desafia para um X1 casual')
        .addStringOption(opt => opt.setName('versao').setDescription('guys, beast, priv...').setRequired(true))
        .addStringOption(opt => opt.setName('mapa').setDescription('Mapa do duelo').setRequired(true))
        .addIntegerOption(opt => opt.setName('rodadas').setDescription('5 ou 7').setRequired(true).addChoices({name:'5',value:5},{name:'7',value:7}))
        .addUserOption(opt => opt.setName('desafiar').setDescription('Selecione o oponente (Opcional)')),

    async execute(interaction) {
        const CANAL_X1 = '1473873994674606231';
        const CANAL_TOPICOS = '1474581144748949648';
        
        if (interaction.channel.id !== CANAL_X1) return interaction.reply({ content: `❌ Este comando só funciona no canal <@#${CANAL_X1}>`, ephemeral: true });

        const oponente = interaction.options.getUser('desafiar');
        const mapa = interaction.options.getString('mapa').toUpperCase();
        const rodadas = interaction.options.getInteger('rodadas');
        const versao = interaction.options.getString('versao');

        // --- REGRA SECRETA ANTI-FARM ---
        const db = JSON.parse(fs.readFileSync('./partidas.json', 'utf8'));
        const userStats = db[interaction.user.id] || { lastMatch: 0, opponents: [] };
        
        // Trava de 7 minutos
        if (Date.now() - userStats.lastMatch < 420000) {
            return interaction.reply({ content: '⚠️ Erro interno na fila: tente novamente em alguns minutos.', ephemeral: true });
        }

        // Trava de repetição (3 partidas com outros antes de repetir)
        if (oponente && userStats.opponents.slice(-3).includes(oponente.id)) {
            return interaction.reply({ content: '⚠️ Conexão instável com este oponente. Tente desafiar outra pessoa.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('⚔️ DESAFIO X1 CASUAL')
            .setColor('#3498db')
            .addFields(
                { name: 'MAPA:', value: mapa, inline: true },
                { name: 'VERSÃO:', value: versao, inline: true },
                { name: 'RODADAS:', value: `${rodadas}`, inline: true }
            );

        if (oponente) {
            // Modo Desafio Direto
            if (oponente.id === interaction.user.id) return interaction.reply({ content: 'Você não pode se desafiar!', ephemeral: true });
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('aceitar_x1').setLabel('ACEITAR').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('recusar_x1').setLabel('RECUSAR').setStyle(ButtonStyle.Danger)
            );

            const msg = await interaction.reply({ content: `${oponente}`, embeds: [embed.setDescription(`${interaction.user} desafiou você!`)], components: [row] });
            
            const collector = msg.createMessageComponentCollector({ time: 300000 });

            collector.on('collect', async i => {
                if (i.user.id !== oponente.id) return i.reply({ content: 'Este desafio não é para você!', ephemeral: true });
                
                if (i.customId === 'recusar_x1') {
                    await i.update({ content: '❌ Desafio recusado.', embeds: [], components: [] });
                    return collector.stop();
                }

                // Iniciar Partida
                await i.update({ content: '✅ Partida Iniciada! Criando tópico...', components: [] });
                iniciarConfronto(interaction, interaction.user, oponente, CANAL_TOPICOS);
            });

        } else {
            // Modo Aberto (Botão Entrar)
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('entrar_x1').setLabel('ENTRAR').setStyle(ButtonStyle.Primary)
            );

            const msg = await interaction.reply({ embeds: [embed.setDescription('Aguardando um oponente...')], components: [row] });
            const collector = msg.createMessageComponentCollector({ time: 300000 });

            collector.on('collect', async i => {
                if (i.user.id === interaction.user.id) return i.reply({ content: 'Aguarde alguém entrar!', ephemeral: true });
                
                await i.update({ content: '✅ Oponente encontrado!', components: [] });
                iniciarConfronto(interaction, interaction.user, i.user, CANAL_TOPICOS);
                collector.stop();
            });
            
            collector.on('end', (c, r) => { if(r === 'time') interaction.editReply({ content: '❌ Expirado.', embeds: [], components: [] }); });
        }
    }
};

// Função auxiliar para criar tópico e registrar dados
async function iniciarConfronto(interaction, p1, p2, canalId) {
    const canal = interaction.guild.channels.cache.get(canalId);
    const thread = await canal.threads.create({ name: `X1-${p1.username}-vs-${p2.username}`, type: ChannelType.PrivateThread });
    await thread.members.add(p1.id); await thread.members.add(p2.id);
    
    // Registrar no DB para o Anti-Farm
    const db = JSON.parse(fs.readFileSync('./partidas.json', 'utf8'));
    [p1, p2].forEach(u => {
        if (!db[u.id]) db[u.id] = { lastMatch: 0, opponents: [] };
        db[u.id].lastMatch = Date.now();
        db[u.id].opponents.push(u.id === p1.id ? p2.id : p1.id);
    });
    fs.writeFileSync('./partidas.json', JSON.stringify(db, null, 2));

    await thread.send(`⚔️ **Duelo Iniciado!** <@${p1.id}> vs <@${p2.id}>\nStaff, use os botões de vitória.`);
}
