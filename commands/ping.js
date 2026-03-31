module.exports = {
  name: "ping",
  description: "ping 테스트",

  async execute(interaction) {
    await interaction.reply("봇 정상 작동");
  }
};