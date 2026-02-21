const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, ChannelType } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('x1')
        .setDescription('Desafia para um X1 casual')
        .addStringOption(o => o.setName('versao').setDescription('guys, beast, priv...').setRequired(true))
        .addStringOption(o => o.setName('mapa').setDescription('Mapa do duelo').setRequired(true))
        .addIntegerOption(o => o.setName('rodadas').setDescription('5 ou 7 rodadas').setRequired(true).addChoices({name:'5',value:5},{name:'7',value:7}))
        .addUserOption(o => o.setName('desafiar').setDescription('Selecione o oponente (Opcional)')),

    async execute(interaction) {
        const CANAL_X1 = '1473873994674606231';
        const CANAL_TOPICOS = '1474581144748949648';
        const ID_CARGO_STAFF = '1453126709447754010';
        const DB_PATH = '/app/data/partidas.json';

        if (interaction.channel.id !== CANAL_X1) {
            return interaction.reply({ content: `❌ Este comando só funciona no canal <@#${CANAL_X1}>`, ephemeral: true });
        }

        const oponente = interaction.options.getUser('desafiar');
        const mapa = interaction.options.getString('mapa').toUpperCase();
        const rodadas = interaction.options.getInteger('rodadas');
        const versao = interaction.options.getString('versao');

        // --- REGRA SECRETA ANTI-FARM ---
        const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
        const userStats = db[interaction.user.id] || { lastMatch: 0, opponents: [] };
        
        if (Date.now() - userStats.lastMatch < 420000) {
            return interaction.reply({ content: '⚠️ Erro interno na fila: tente novamente em alguns minutos.', ephemeral: true });
        }

        if (oponente && userStats.opponents.slice(-3).includes(oponente.id)) {
            return interaction.reply({ content: '⚠️ Conexão instável com este oponente. Tente desafiar outra pessoa.', ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('⚔️ NOVO X1 CASUAL')
            .setColor('#3498db')
            .addFields(
                { name: 'MAPA:', value: mapa, inline: true },
                { name: 'VERSÃO:', value: versao.toUpperCase(), inline: true },
                { name: 'RODADAS:', value: `${rodadas}`, inline: true }
            )
            .setFooter({ text: 'alpha • Aguardando oponente...' });

        if (oponente) {
            if (oponente.id === interaction.user.id) return interaction.reply({ content: 'Você não pode se desafiar!', ephemeral: true });
            
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('acc_x1').setLabel('ACEITAR').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId('rec_x1').setLabel('RECUSAR').setStyle(ButtonStyle.Danger)
            );

            const msg = await interaction.reply({ content: `${oponente}`, embeds: [embed.setDescription(`${interaction.user} desafiou você!`)], components: [row] });
            const collector = msg.createMessageComponentCollector({ time: 300000 });

            collector.on('collect', async i => {
                if (i.user.id !== oponente.id) return i.reply({ content: 'Não é para você!', ephemeral: true });
                if (i.customId === 'rec_x1') {
                    await i.update({ content: '❌ Desafio recusado.', embeds: [], components: [] });
                    return collector.stop();
                }
                await i.update({ content: '✅ Partida Iniciada!', components: [] });
                this.iniciarConfronto(interaction, interaction.user, oponente, CANAL_TOPICOS, ID_CARGO_STAFF);
            });

        } else {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('ent_x1').setLabel('ENTRAR').setStyle(ButtonStyle.Primary)
            );

            const msg = await interaction.reply({ embeds: [embed.setDescription('Aguardando um oponente...')], components: [row] });
            const collector = msg.createMessageComponentCollector({ time: 300000 });

            collector.on('collect', async i => {
                if (i.user.id === interaction.user.id) return i.reply({ content: 'Aguarde alguém entrar!', ephemeral: true });
                await i.update({ content: '✅ Oponente encontrado!', components: [] });
                this.iniciarConfronto(interaction, interaction.user, i.user, CANAL_TOPICOS, ID_CARGO_STAFF);
                collector.stop();
            });
        }
    },

    async iniciarConfronto(interaction, p1, p2, canalId, staffId) {
        const canal = interaction.guild.channels.cache.get(canalId);
        const thread = await canal.threads.create({ 
            name: `X1-${p1.username}-vs-${p2.username}`, 
            type: ChannelType.PrivateThread 
        });

        await thread.members.add(p1.id);
        await thread.members.add(p2.id);
        
        // Registrar Anti-Farm no Volume
        const DB_PATH = '/app/data/partidas.json';
        const RANK_PATH = '/app/data/ranking.json';
        const db = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));

        [p1, p2].forEach(u => {
            if (!db[u.id]) db[u.id] = { lastMatch: 0, opponents: [] };
            db[u.id].lastMatch = Date.now();
            db[u.id].opponents.push(u.id === p1.id ? p2.id : p1.id);
        });
        fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));

        // BOTOES DE STAFF (CORRIGIDO)
        const rowVenc = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`vx1_${p1.id}`).setLabel(`Vencer P1`).setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`vx1_${p2.id}`).setLabel(`Vencer P2`).setStyle(ButtonStyle.Success)
        );

        const msgThread = await thread.send({ 
            content: `⚔️ **Duelo Iniciado!** <@${p1.id}> vs <@${p2.id}>\nStaff <@&${staffId}>, use os botões abaixo:`, 
            components: [rowVenc] 
        });

        const staffCol = msgThread.createMessageComponentCollector({ componentType: ComponentType.Button });

        staffCol.on('collect', async b => {
            // TRAVA DE CARGO: Permite que QUALQUER Staff use
            if (!b.member.roles.cache.has(staffId)) {
                return b.reply({ content: '❌ Apenas staff pode declarar vitória!', ephemeral: true });
            }

            const vencedorId = b.customId.replace('vx1_', '');
            const perdedorId = vencedorId === p1.id ? p2.id : p1.id;

            // Salvar no Ranking do Volume
            const rData = JSON.parse(fs.readFileSync(RANK_PATH, 'utf8'));
            if (!rData[vencedorId]) rData[vencedorId] = { simuV: 0, simuP: 0, apV: 0, apP: 0, x1V: 0, x1P: 0 };
            if (!rData[perdedorId]) rData[perdedorId] = { simuV: 0, simuP: 0, apV: 0, apP: 0, x1V: 0, x1P: 0 };
            
            rData[vencedorId].x1V += 1;
            rData[perdedorId].x1P += 1;
            fs.writeFileSync(RANK_PATH, JSON.stringify(rData, null, 2));

            await b.update({ content: `🏆 Vitória confirmada para: <@${vencedorId}>`, components: [] });
            setTimeout(() => thread.delete().catch(() => {}), 10000);
        });
    }
};
