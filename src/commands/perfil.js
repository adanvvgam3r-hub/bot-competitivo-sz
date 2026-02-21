const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('perfil')
        .setDescription('Veja o perfil competitivo de um jogador')
        .addUserOption(opt => opt.setName('quem').setDescription('Selecione o jogador (Opcional)')),

    async execute(interaction) {
        const target = interaction.options.getUser('quem') || interaction.user;
        const rankingPath = path.join(__dirname, '../../ranking.json');

        // Pega o avatar em alta resolução
        const avatarUrl = target.displayAvatarURL({ dynamic: true, size: 1024 });

        // Valores padrão (caso o jogador não tenha dados)
        let dados = { 
            simuV: 0, simuP: 0, 
            apV: 0, apP: 0, 
            x1V: 0, x1P: 0 
        };

        // Tenta ler o arquivo de ranking
        if (fs.existsSync(rankingPath)) {
            try {
                const allData = JSON.parse(fs.readFileSync(rankingPath, 'utf8'));
                if (allData[target.id]) {
                    // Mescla os dados do arquivo com os valores padrão
                    dados = { ...dados, ...allData[target.id] };
                }
            } catch (e) {
                console.error("Erro ao ler ranking.json:", e);
            }
        }

        const embed = new EmbedBuilder()
            .setTitle(`PERFIL COMPETITIVO - ALPHA`)
            .setThumbnail(avatarUrl)
            .setColor('#8b00ff') // Roxo padrão da Copa SZ
            .setAuthor({ name: target.username, iconURL: avatarUrl })
            .setDescription(`Exibindo estatísticas de: ${target}`)
            .setTimestamp();

        // Verifica se o jogador tem alguma atividade
        const temDados = Object.values(dados).some(v => v > 0);

        if (!temDados) {
            embed.addFields({ name: '\u200B', value: '❌ **Este jogador ainda não possui dados registrados.**' });
        } else {
            embed.addFields(
                { 
                    name: '🏆 SIMULADORES', 
                    value: `Venceu: \`${dados.simuV}\` | Vice: \`${dados.simuP}\``, 
                    inline: false 
                },
                { 
                    name: '💰 APOSTADOS (AP)', 
                    value: `Venceu: \`${dados.apV}\` | Perdeu: \`${dados.apP}\``, 
                    inline: false 
                },
                { 
                    name: '⚔️ X1 CASUAL', 
                    value: `Venceu: \`${dados.x1V}\` | Perdeu: \`${dados.x1P}\``, 
                    inline: false 
                }
            );
        }

        await interaction.reply({ embeds: [embed] });
    }
};
