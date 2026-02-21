const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
const fs = require('fs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('simu2v2')
        .setDescription('Inicia um simulador 2v2 com escolha de vagas')
        .addStringOption(o => o.setName('versao').setDescription('Versão').setRequired(true))
        .addIntegerOption(o => o.setName('vagas').setDescription('Total de jogadores').setRequired(true).addChoices({name:'4 (2 duplas)',value:4},{name:'8 (4 duplas)',value:8}))
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
        
        // Inicializa os slots vazios
        let slots = Array(vagas).fill(null);

        const gerarEmbed = () => {
            const listaSorteada = slots.map((user, i) => `${i + 1}. ${user ? `<@${user}>` : '----'}`).join('\n');
            const inscritosCount = slots.filter(s => s !== null).length;

            return new EmbedBuilder()
                .setTitle('🏆 SIMULADOR 2V2 - ESCOLHA SEU SLOT')
                .setColor('#2ecc71')
                .setDescription(`Expira em <t:${Math.floor((Date.now() + expiraMin * 60000) / 1000)}:R>\n\n**VERSÃO:** ${versao}\n**MAPA:** ${mapa}\n\n**PARTICIPANTES:**\n${listaSorteada}`)
                .setFooter({ text: `Vagas preenchidas: ${inscritosCount}/${vagas} | Duplas: 1&2, 3&4, 5&6, 7&8` });
        };

        const menu = new StringSelectMenuBuilder()
            .setCustomId('selecionar_vaga')
            .setPlaceholder('Escolha sua vaga no simulador')
            .addOptions(
                Array.from({ length: vagas }, (_, i) => 
                    new StringSelectMenuOptionBuilder()
                        .setLabel(`Vaga ${i + 1}`)
                        .setValue(`${i}`)
                )
            );

        const row = new ActionRowBuilder().addComponents(menu);
        const res = await interaction.reply({ embeds: [gerarEmbed()], components: [row] });

        const col = res.createMessageComponentCollector({ time: expiraMin * 60000 });

        col.on('collect', async i => {
            if (i.customId === 'selecionar_vaga') {
                const vagaEscolhida = parseInt(i.values[0]);

                // Verifica se o jogador já está em outra vaga
                if (slots.includes(i.user.id)) {
                    return i.reply({ content: '❌ Você já está inscrito em uma vaga!', ephemeral: true });
                }

                // Verifica se a vaga já foi ocupada
                if (slots[vagaEscolhida] !== null) {
                    return i.reply({ content: '❌ Esta vaga já foi preenchida por outro jogador!', ephemeral: true });
                }

                slots[vagaEscolhida] = i.user.id;
                const lotado = slots.every(s => s !== null);

                if (lotado) col.stop('lotado');
                else await i.update({ embeds: [gerarEmbed()] });
            }
        });

             col.on('end', async (collected, reason) => {
            if (reason !== 'lotado') {
                return interaction.editReply({ content: '❌ Inscrições expiradas.', embeds: [], components: [] });
            }

            // Atualiza a Embed para remover o tempo e mostrar que iniciou
            const embedFinal = gerarEmbed()
                .setDescription('✅ **INSCRIÇÕES ENCERRADAS - SIMULADOR EM ANDAMENTO**')
                .setColor('#00ff00'); // Muda para verde indicando sucesso

            await interaction.editReply({ embeds: [embedFinal], components: [] });

            const players = [...inscritos].sort(() => Math.random() - 0.5);
            // ... resto do código de criação dos tópicos ...

            if (reason !== 'lotado') return interaction.editReply({ content: '❌ Tempo expirado.', embeds: [], components: [] });

            await interaction.editReply({ content: '⚔️ **Vagas lotadas! Criando duplas por slots...**', components: [] });
            const canal = interaction.guild.channels.cache.get(ID_CONFRONTOS);

            // Formação de Duplas: 0&1 vs 2&3, etc.
            for (let i = 0; i < slots.length; i += 4) {
                const idx = i/4;
                const timeA = [slots[i], slots[i+1]];
                const timeB = [slots[i+2], slots[i+3]];

                const th = await canal.threads.create({ name: `2v2-Slot-Duelo-${idx}`, type: ChannelType.PrivateThread });
                [...timeA, ...timeB].forEach(id => th.members.add(id).catch(() => {}));

                const rowV = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`v2a_${idx}`).setLabel('Vencer Time A (Slots 1&2)').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId(`v2b_${idx}`).setLabel('Vencer Time B (Slots 3&4)').setStyle(ButtonStyle.Success)
                );

                const msgT = await th.send({ 
                    content: `⚔️ **CONFRONTO 2V2 (SLOTS)**\n**TIME A:** <@${timeA[0]}> & <@${timeA[1]}>\n**VS**\n**TIME B:** <@${timeB[0]}> & <@${timeB[1]}>\n\n**Organizador:** <@${ORGANIZADOR_ID}>`, 
                    components: [rowV] 
                });

                const sCol = msgT.createMessageComponentCollector();
                sCol.on('collect', async b => {
                    if (b.user.id !== ORGANIZADOR_ID) return b.reply({ content: 'Apenas o organizador pode declarar!', ephemeral: true });
                    
                    const venceuA = b.customId.includes('v2a');
                    const vTime = venceuA ? timeA : timeB;
                    const pTime = venceuA ? timeB : timeA;

                    // Final: idx 0 (4 vagas) ou idx 1 (8 vagas)
                    if (parseInt(b.customId.slice(-1)) === (vagas === 4 ? 0 : 1)) {
                        const data = JSON.parse(fs.readFileSync(PATH, 'utf8'));
                        [...vTime, ...pTime].forEach(id => { if(!data[id]) data[id] = { simuV:0, simuP:0, apV:0, apP:0, x1V:0, x1P:0 }; });
                        vTime.forEach(id => data[id].simuV += 1);
                        pTime.forEach(id => data[id].simuP += 1);
                        fs.writeFileSync(PATH, JSON.stringify(data, null, 2));
                    }

                    await b.update({ content: `🏆 Vitória da Dupla: <@${vTime[0]}> & <@${vTime[1]}>`, components: [] });
                    setTimeout(() => th.delete().catch(() => {}), 10000);
                });
            }
        });
    }
};
