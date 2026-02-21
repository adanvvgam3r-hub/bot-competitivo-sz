const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mensagem-privada')
        .setDescription('Envia uma DM para um membro específico')
        // 🛡️ O comando só aparece para quem pode Gerenciar Mensagens (Staff/Mod)
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addUserOption(opt => opt.setName('quem').setDescription('Membro alvo').setRequired(true))
        .addStringOption(opt => opt.setName('mensagem').setDescription('Conteúdo').setRequired(true)),

    async execute(interaction) {
        const ID_CARGO_STAFF = '1453126709447754010';
        const ID_CARGO_MOD = '1452823591669203017';
        
        const temCargo = interaction.member.roles.cache.has(ID_CARGO_STAFF) || 
                         interaction.member.roles.cache.has(ID_CARGO_MOD);

        if (!temCargo) {
            return interaction.reply({ content: '❌ Você não tem os cargos necessários.', ephemeral: true });
        }

        const target = interaction.options.getUser('quem');
        const conteudo = interaction.options.getString('mensagem');

        try {
            await target.send(`📩 **Mensagem da Staff:**\n\n${conteudo}`);
            await interaction.reply({ content: `✅ Enviada para ${target.username}`, ephemeral: true });
        } catch (e) {
            await interaction.reply({ content: `❌ DM Fechada.`, ephemeral: true });
        }
    }
};
