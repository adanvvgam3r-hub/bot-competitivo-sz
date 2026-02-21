const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChannelType } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ap')
        .setDescription('Desafia para um X1 Apostado (valendo dinheiro)')
        .addStringOption(opt => opt.setName('versao').setDescription('guys, beast, priv...').setRequired(true))
        .addStringOption(opt => opt.setName('mapa').setDescription('Mapa do duelo').setRequired(true))
        .addNumberOption(opt => opt.setName('valor').setDescription('Valor da aposta em R$').setRequired(true))
        .addIntegerOption(opt => opt.setName('rodadas').setDescription('5 ou 7').setRequired(true).addChoices({name:'5',value:5},{name:'7',value:7}))
        .addUserOption(opt => opt.setName('desafiar').setDescription('Selecione o oponente (Opcional)')),

    async execute(interaction) {
        const CANAL_AP = '1473873854232264886'; // Canal de Apostados
        const CANAL_TOPICOS = '1474581144748949648'; // Canal de Tópicos
        const ID_CARGO_STAFF = '1453126709447754010';
        
        if (interaction.channel.id !== CANAL_AP) {
            return interaction.reply({ content: `❌ Este comando só funciona no canal <@#${CANAL_AP}>`, ephemeral: true });
        }

        const oponente = interaction.options.getUser('desafiar');
        const mapa = interaction.options.getString('mapa').toUpperCase();
        const rodadas = interaction.options.getInteger('rodadas');
        const versao = interaction.options.getString('versao');
        const valor = interaction.options.getNumber('valor');

        // --- REGRA SECRETA ANTI-FARM (MESMA DO X1) ---
        const dbPath = './partidas.json';
        const db = fs.existsSync(dbPath) ? JSON.parse(fs.readFileSync(dbPath, 'utf8')) : {};
        const userStats = db[interaction.user.id] || { lastMatch: 0, opponents: [] };
        
        if (Date.now() - userStats.lastMatch < 420000) {
            return interaction.reply({ content: '⚠️ Erro interno na fila: tente novamente em alguns minutos.', ephemeral: true });
        }

        if (oponente && userStats.opponents.slice(-3).includes(oponente.id)) {
            return interaction.reply({ content: '⚠️ Conexão instável com este oponente. Tente desafiar outra pessoa.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('💰 NOVO X1 APOSTADO')
            .setColor('#2ecc71') // Verde Dinheiro
            .addFields(
                { name: 'VALOR:', value: `R$ ${valor.toFixed(2)}`, inline: true },
                { name: 'MAPA:', value: mapa, inline: true },
                { name: 'VERSÃO:', value: versao.toUpperCase(), inline: true },
                { name: 'RODADAS:', value: `${rodadas}`, inline: false }
            )
            .setFooter({ text: 'Aguardando confirmação...' });

        if (oponente) {
            if (oponente.id === interaction.user.id) return interaction.reply({ content: 'Você não pode se desafiar!', ephemeral: true });
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('aceitar_ap').setLabel('ACEITAR APOSTA').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('recusar_ap').setLabel('RECUSAR').setStyle(ButtonStyle.Danger)
            );

            const msg = await interaction.reply({ content: `${oponente}`, embeds: [embed.setDescription(`${interaction.user} desafiou você para um apostado!`)], components: [row] });
            
            const collector = msg.createMessageComponentCollector({ time: 300000 });

            collector.on('collect', async i => {
                if (i.user.id !== oponente.id) return i.reply({ content: 'Este desafio não é para você!', ephemeral: true });
                
                if (i.customId === 'recusar_ap') {
                    await i.update({ content: '❌ Aposta recusada.', embeds: [], components: [] });
                    return collector.stop();
                }

                await i.update({ content: '✅ Aposta Aceita! Criando tópico de confronto...', components: [] });
                criarTopico(interaction, interaction.user, oponente, CANAL_TOPICOS, valor, ID_CARGO_STAFF);
            });

        } else {
            // MODO ABERTO
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('entrar_ap').setLabel('ENTRAR NA APOSTA').setStyle(ButtonStyle.Primary)
            );

            const msg = await interaction.reply({ embeds: [embed.setDescription('Alguém aceita o desafio apostado?')], components: [row] });
            const collector = msg.createMessageComponentCollector({ time: 300000 });

            collector.on('collect', async i => {
                if (i.user.id === interaction.user.id) return i.reply({ content: 'Aguarde um oponente!', ephemeral: true });
                
                await i.update({ content: '✅ Desafio aceito!', components: [] });
                criarTopico(interaction, interaction.user, i.user, CANAL_TOPICOS, valor, ID_CARGO_STAFF);
                collector.stop();
            });
        }
    }
};

async function criarTopico(interaction, p1, p2, canalId, valor, staffId) {
    const canal = interaction.guild.channels.cache.get(canalId);
    if (!canal) return;

    const thread = await canal.threads.create({
        name: `AP-${p1.username}-vs-${p2.username}`,
        type: ChannelType.PrivateThread,
        reason: 'X1 Apostado'
    });

    await thread.members.add(p1.id);
    await thread.members.add(p2.id);

    // Registro Anti-Farm
    const dbPath = './partidas.json';
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
    [p1, p2].forEach(u => {
        if (!db[u.id]) db[u.id] = { lastMatch: 0, opponents: [] };
        db[u.id].lastMatch = Date.now();
        db[u.id].opponents.push(u.id === p1.id ? p2.id : p1.id);
    });
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

    const embedConfronto = new EmbedBuilder()
        .setTitle('⚔️ CONFRONTO APOSTADO INICIADO')
        .setColor('#2ecc71')
        .setDescription(`Jogadores: <@${p1.id}> vs <@${p2.id}>\n**VALOR EM JOGO:** R$ ${valor.toFixed(2)}\n\nStaff <@&${staffId}> deve declarar o vencedor.`);

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`v_ap_${p1.id}`).setLabel(`Vencer P1`).setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`v_ap_${p2.id}`).setLabel(`Vencer P2`).setStyle(ButtonStyle.Success)
    );

    const msg = await thread.send({ embeds: [embedConfronto], components: [row] });
    
    const staffCol = msg.createMessageComponentCollector({ componentType: ComponentType.Button });
    staffCol.on('collect', async b => {
        if (!b.member.roles.cache.has(staffId)) return b.reply({ content: 'Apenas Staff pode declarar vitória em apostados!', ephemeral: true });
        
        const vencedorId = b.customId.replace('v_ap_', '');
        const perdedorId = vencedorId === p1.id ? p2.id : p1.id;

        // --- SALVAR NO RANKING/PERFIL ---
        const rPath = './ranking.json';
        const rData = JSON.parse(fs.readFileSync(rPath, 'utf8'));
        if (!rData[vencedorId]) rData[vencedorId] = { simuV: 0, simuP: 0, apV: 0, apP: 0, x1V: 0, x1P: 0 };
        if (!rData[perdedorId]) rData[perdedorId] = { simuV: 0, simuP: 0, apV: 0, apP: 0, x1V: 0, x1P: 0 };
        
        rData[vencedorId].apV += 1;
        rData[perdedorId].apP += 1;
        fs.writeFileSync(rPath, JSON.stringify(rData, null, 2));

        await b.update({ content: `🏆 Vitória confirmada para: <@${vencedorId}>. Dados salvos no perfil!`, components: [], embeds: [] });
        setTimeout(() => thread.delete().catch(() => {}), 30000);
    });
}
