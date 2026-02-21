const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simu2v2')
        .setDescription('Inicia um simulador 2v2 com escolha de vaga')
        .addStringOption(o => o.setName('versao').setDescription('Versão').setRequired(true))
        .addIntegerOption(o => o.setName('vagas').setDescription('Total de jogadores').setRequired(true).addChoices({name:'4',value:4},{name:'8',value:8}))
        .addStringOption(o => o.setName('mapa').setDescription('Mapa').setRequired(true))
        .addIntegerOption(o => o.setName('expira').setDescription('Minutos').setRequired(true)),

    async execute(interaction) {
        const ID_STAFF = '1453126709447754010';
        const ID_CONFRONTOS = '1474560305492394106';
        const PATH = '/app/data/ranking.json';
        const ORGANIZADOR_ID = interaction.user.id;

        if (!interaction.member.roles.cache.has(ID_STAFF)) return interaction.reply({ content: '❌ Staff apenas!', ephemeral: true });

        const vagas = interaction.options.getInteger('vagas');
        const versao = interaction.options.getString('versao').toUpperCase();
        const mapa = interaction.options.getString('mapa').toUpperCase();
        const expiraMin = interaction.options.getInteger('expira');
        let slots = Array(vagas).fill(null);

        const gerarEmbed = (encerrado = false) => {
            const lista = slots.map((user, i) => `${i + 1}. ${user ? `<@${user}>` : '----'}`).join('\n');
            const desc = encerrado ? '✅ **INSCRIÇÕES ENCERRADAS - SIMULADOR INICIADO**' : `Expira em <t:${Math.floor((Date.now() + expiraMin * 60000) / 1000)}:R>`;

            return new EmbedBuilder()
                .setTitle('🏆 SIMULADOR 2V2')
                .setColor(encerrado ? '#00ff00' : '#2ecc71')
                .setDescription(`${desc}\n\n**VERSÃO:** ${versao}\n**MAPA:** ${mapa}\n\n**PARTICIPANTES:**\n${lista}`)
                .setFooter({ text: `Vagas: ${slots.filter(s => s !== null).length}/${vagas}` });
        };

        const menu = new StringSelectMenuBuilder()
            .setCustomId('sel_2v2')
            .setPlaceholder('Escolha sua vaga')
            .addOptions(Array.from({ length: vagas }, (_, i) => new StringSelectMenuOptionBuilder().setLabel(`Vaga ${i + 1}`).setValue(`${i}`)));

        const res = await interaction.reply({ embeds: [gerarEmbed()], components: [new ActionRowBuilder().addComponents(menu)] });
        const col = res.createMessageComponentCollector({ time: expiraMin * 60000 });

        col.on('collect', async i => {
            if (slots.includes(i.user.id)) return i.reply({ content: 'Já inscrito!', ephemeral: true });
            const vIdx = parseInt(i.values[0]);
            if (slots[vIdx] !== null) return i.reply({ content: 'Vaga ocupada!', ephemeral: true });

            slots[vIdx] = i.user.id;
            if (slots.every(s => s !== null)) col.stop('lotado');
            else await i.update({ embeds: [gerarEmbed()] });
        });

        col.on('end', async (collected, reason) => {
            if (reason !== 'lotado') return interaction.editReply({ content: '❌ Expirado.', embeds: [], components: [] });

            await interaction.editReply({ embeds: [gerarEmbed(true)], components: [] });
            const canal = interaction.guild.channels.cache.get(ID_CONFRONTOS);

            for (let i = 0; i < slots.length; i += 4) {
                const idx = i/4; const tA = [slots[i], slots[i+1]]; const tB = [slots[i+2], slots[i+3]];
                const th = await canal.threads.create({ name: `2v2-Duelo-${idx}`, type: ChannelType.PrivateThread });
                [...tA, ...tB].forEach(id => th.members.add(id).catch(() => {}));

                const bt = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`v2a_${idx}`).setLabel('Vencer Time A').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`v2b_${idx}`).setLabel('Vencer Time B').setStyle(ButtonStyle.Success)
                );

                const m = await th.send({ content: `⚔️ **TIME A:** <@${tA[0]}> & <@${tA[1]}>\n**VS**\n**TIME B:** <@${tB[0]}> & <@${tB[1]}>\n\n**Organizador:** <@${ORGANIZADOR_ID}>`, components: [bt] });
                const sCol = m.createMessageComponentCollector();

                sCol.on('collect', async b => {
                    if (b.user.id !== ORGANIZADOR_ID) return b.reply({ content: 'Apenas o organizador!', ephemeral: true });
                    const isA = b.customId.includes('v2a');
                    const vTime = isA ? tA : tB; const pTime = isA ? tB : tA;

                    if (parseInt(b.customId.slice(-1)) === (vagas === 4 ? 0 : 1)) {
                        const data = JSON.parse(fs.readFileSync(PATH, 'utf8'));
                        [...vTime, ...pTime].forEach(id => { if(!data[id]) data[id] = { simuV:0, simuP:0, apV:0, apP:0, x1V:0, x1P:0 }; });
                        vTime.forEach(id => data[id].simuV += 1); pTime.forEach(id => data[id].simuP += 1);
                        fs.writeFileSync(PATH, JSON.stringify(data, null, 2));
                    }
                    await b.update({ content: `🏆 Vitória: <@${vTime[0]}> & <@${vTime[1]}>`, components: [] });
                    setTimeout(() => th.delete().catch(() => {}), 10000);
                });
            }
        });
    }
};
