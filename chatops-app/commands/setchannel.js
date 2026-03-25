const { setGuildChatChannel } = require("../services/guildSettings");

module.exports = {
  name: "setchannel",
  description: "현재 채널을 챗봇 채널로 설정",

  async execute(interaction) {
    const guildId = interaction.guildId;
    const channelId = interaction.channelId;

    setGuildChatChannel(guildId, channelId);

    await interaction.reply({
      content: "이 채널이 챗봇 채널로 설정되었습니다.",
      ephemeral: true,
    });
  },
};