const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ap')
        .setDescription('X1 Apostado')
        .addStringOption(o => o.setName('versao').setRequired(true).setDescription('guys'))
        .addStringOption(o => o.setName('mapa').setRequired(true).setDescription('mapa'))
        .addNumberOption(o => o.setName('valor').setRequired(true).setDescription('R$'))
        .addIntegerOption(o => o.setName('rodadas').setDescription('Quantidade de rodadas').setRequired(true).addChoices({name:'5',value:5},{name:'7',value:7}))
        .addUserOption(o => o.setName('desafiar').setDescription('Oponente')),

    async execute(interaction) {
        const CANAL_AP = '1473873854232264886';
        const CANAL_TOP = '1474581144748949648';
        const STAFF = '1452822605773148312';
        const DB = '/app/data/partidas.json';
        const RANK = '/app/data/ranking.json';

        if (interaction.channel.id !== CANAL_AP) return interaction.reply({ content: 'Canal errado!', ephemeral: true });

        const op = interaction.options.getUser('desafiar');
        const valor = interaction.options.getNumber('valor');
        const db = JSON.parse(fs.readFileSync(DB, 'utf8'));
        const stats = db[interaction.user.id] || { lastMatch: 0, opponents: [] };

        if (Date.now() - stats.lastMatch < 420000) return interaction.reply({ content: '⚠️ Conexão instável. Tente em 7 min.', ephemeral: true });
        if (op && stats.opponents.slice(-3).includes(op.id)) return interaction.reply({ content: '⚠️ Erro de conexão com este player.', ephemeral: true });

        const embed = new EmbedBuilder().setTitle('💰 APOSTADO').setColor('#2ecc71').addFields({name:'VALOR', value:`R$ ${valor.toFixed(2)}`});
        
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('acc').setLabel('ACEITAR').setStyle(ButtonStyle.Success));
        const res = await interaction.reply({ content: op ? `${op}` : 'Aguardando oponente...', embeds: [embed], components: [row] });

        const col = res.createMessageComponentCollector({ time: 300000 });
        col.on('collect', async i => {
            if (op && i.user.id !== op.id) return i.reply({ content: 'Não é para você!', ephemeral: true });
            if (!op && i.user.id === interaction.user.id) return i.reply({ content: 'Aguarde!', ephemeral: true });

            await i.update({ content: '✅ Inicidado!', components: [] });
            const th = await interaction.guild.channels.cache.get(CANAL_TOP).threads.create({ name: `AP-${i.user.username}`, type: ChannelType.PrivateThread });
            await th.members.add(interaction.user.id); await th.members.add(i.user.id);

            // Anti-Farm Save
            [interaction.user.id, i.user.id].forEach(id => {
                if(!db[id]) db[id] = { lastMatch: 0, opponents: [] };
                db[id].lastMatch = Date.now();
                db[id].opponents.push(id === interaction.user.id ? i.user.id : interaction.user.id);
            });
            fs.writeFileSync(DB, JSON.stringify(db, null, 2));

            const m = await th.send({ content: `⚔️ <@${interaction.user.id}> vs <@${i.user.id}>\nValor: R$ ${valor}`, components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`v_ap_${interaction.user.id}`).setLabel('Vencer P1').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId(`v_ap_${i.user.id}`).setLabel('Vencer P2').setStyle(ButtonStyle.Success))] });
            
            const sCol = m.createMessageComponentCollector();
            sCol.on('collect', async b => {
                if (!b.member.roles.cache.has(STAFF)) return b.reply({ content: 'Staff apenas!', ephemeral: true });
                const vId = b.customId.replace('v_ap_', '');
                const pId = vId === interaction.user.id ? i.user.id : interaction.user.id;
                const r = JSON.parse(fs.readFileSync(RANK, 'utf8'));
                if(!r[vId]) r[vId] = { simuV: 0, simuP: 0, apV: 0, apP: 0, x1V: 0, x1P: 0 };
                if(!r[pId]) r[pId] = { simuV: 0, simuP: 0, apV: 0, apP: 0, x1V: 0, x1P: 0 };
                r[vId].apV += 1; r[pId].apP += 1;
                fs.writeFileSync(RANK, JSON.stringify(r, null, 2));
                await b.update({ content: `🏆 Vitória: <@${vId}>`, components: [] });
                setTimeout(() => th.delete().catch(() => {}), 10000);
            });
            col.stop();
        });
    }
};
