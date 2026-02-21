const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simu1v1')
        .setDescription('Inicia um simulador 1v1')
        .addStringOption(o => o.setName('versao').setDescription('Versão').setRequired(true))
        .addIntegerOption(o => o.setName('vagas').setDescription('Total de jogadores').setRequired(true).addChoices({name:'2',value:2},{name:'4',value:4},{name:'8',value:8}))
        .addStringOption(o => o.setName('mapa').setDescription('Mapa').setRequired(true))
        .addIntegerOption(o => o.setName('expira').setDescription('Minutos').setRequired(true)),

    async execute(interaction) {
        const ID_STAFF = '1453126709447754010';
        const CANAL_PERMITIDO = '1465842384586670254'; // CANAL DE INSCRIÇÕES
        const ID_CONFRONTOS = '1474560305492394106';
        const PATH = '/app/data/ranking.json';
        const CONFIG_PATH = '/app/data/ranking_config.json';
        const ORGANIZADOR_ID = interaction.user.id;

        // 🛡️ TRAVA DE CANAL
        if (interaction.channel.id !== CANAL_PERMITIDO) {
            return interaction.reply({ content: `❌ Este comando só pode ser usado no canal <@#${CANAL_PERMITIDO}>!`, ephemeral: true });
        }

        // 🛡️ TRAVA DE CARGO
        if (!interaction.member.roles.cache.has(ID_STAFF)) {
            return interaction.reply({ content: '❌ Você não tem permissão para iniciar um simulador!', ephemeral: true });
        }

        const vagas = interaction.options.getInteger('vagas');
        const versao = interaction.options.getString('versao').toUpperCase();
        const mapa = interaction.options.getString('mapa').toUpperCase();
        const expiraMin = interaction.options.getInteger('expira');
        let slots = Array(vagas).fill(null);

        const gerarEmbed = (encerrado = false) => {
            const lista = slots.map((user, i) => `${i + 1}. ${user ? `<@${user}>` : '----'}`).join('\n');
            const desc = encerrado ? '✅ **INSCRIÇÕES ENCERRADAS - SIMULADOR INICIADO**' : `Expira em <t:${Math.floor((Date.now() + expiraMin * 60000) / 1000)}:R>`;
            return new EmbedBuilder()
                .setTitle('🏆 SIMULADOR 1V1')
                .setColor(encerrado ? '#00ff00' : '#8b00ff')
                .setDescription(`${desc}\n\n**VERSÃO:** ${versao}\n**MAPA:** ${mapa}\n\n**PARTICIPANTES:**\n${lista}`)
                .setFooter({ text: `Vagas: ${slots.filter(s => s !== null).length}/${vagas}` });
        };

        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('entrar_1v1').setLabel('ENTRAR NO SIMU').setStyle(ButtonStyle.Primary));
        const res = await interaction.reply({ embeds: [gerarEmbed()], components: [row] });
        const col = res.createMessageComponentCollector({ time: expiraMin * 60000 });

        col.on('collect', async i => {
            if (slots.includes(i.user.id)) return i.reply({ content: '❌ Já inscrito!', ephemeral: true });
            const vLivre = slots.indexOf(null);
            if (vLivre === -1) return i.reply({ content: '❌ Lotado!', ephemeral: true });
            slots[vLivre] = i.user.id;
            if (slots.every(s => s !== null)) col.stop('lotado');
            else await i.update({ embeds: [gerarEmbed()] });
        });

        col.on('end', async (collected, reason) => {
            if (reason !== 'lotado') return interaction.editReply({ content: '❌ Expirado.', embeds: [], components: [] });
            await interaction.editReply({ embeds: [gerarEmbed(true)], components: [] });
            const canal = interaction.guild.channels.cache.get(ID_CONFRONTOS);
            const players = [...slots].sort(() => Math.random() - 0.5);

            for (let i = 0; i < players.length; i += 2) {
                const idx = i/2; const p1 = players[i]; const p2 = players[i+1];
                const th = await canal.threads.create({ name: `1v1-Duelo-${idx}`, type: ChannelType.PrivateThread });
                await th.members.add(p1); await th.members.add(p2);
                const bt = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`v1_${p1}_${idx}`).setLabel('Vencer P1').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`v1_${p2}_${idx}`).setLabel('Vencer P2').setStyle(ButtonStyle.Success)
                );
                const m = await th.send({ content: `⚔️ <@${p1}> vs <@${p2}>\n**Org:** <@${ORGANIZADOR_ID}>`, components: [bt] });
                const sCol = m.createMessageComponentCollector();

                sCol.on('collect', async b => {
                    if (b.user.id !== ORGANIZADOR_ID) return b.reply({ content: `❌ Apenas o organizador pode declarar!`, ephemeral: true });
                    const args = b.customId.split('_');
                    const vId = args[1]; const pId = vId === p1 ? p2 : p1;

                    if (parseInt(args[2]) === (vagas/2)-1) {
                        const data = JSON.parse(fs.readFileSync(PATH, 'utf8'));
                        [vId, pId].forEach(id => { if(!data[id]) data[id] = { simuV:0, simuP:0, apV:0, apP:0, x1V:0, x1P:0 }; });
                        data[vId].simuV += 1; data[pId].simuP += 1;
                        fs.writeFileSync(PATH, JSON.stringify(data, null, 2));

                        if (fs.existsSync(CONFIG_PATH)) {
                            const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
                            const rChan = await interaction.guild.channels.fetch(config.channelId);
                            const rMsg = await rChan.messages.fetch(config.messageId);
                            const top10 = Object.entries(data).sort((a,b) => (b[1].simuV || 0) - (a[1].simuV || 0)).slice(0, 10);
                            let grade = "```md\nPOS  NOME            VITS   VICE\n---  ------------    ----   ----\n";
                            top10.forEach(([id, s], i) => {
                                const n = (interaction.guild.members.cache.get(id)?.displayName || "Player").slice(0,12).padEnd(12,' ');
                                grade += `${(i+1).toString().padEnd(3,' ')}  ${n}    ${(s.simuV || 0).toString().padEnd(4,' ')}   ${(s.simuP || 0).toString().padEnd(4,' ')}\n`;
                            });
                            grade += "```";
                            const nEmb = EmbedBuilder.from(rMsg.embeds[0]).setDescription(grade);
                            await rMsg.edit({ embeds: [nEmb] }).catch(() => {});
                        }
                    }
                    await b.update({ content: `🏆 Vitória: <@${vId}>`, components: [] });
                    setTimeout(() => th.delete().catch(() => {}), 10000);
                });
            }
        });
    }
};
