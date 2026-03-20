module.exports = {
  name: "test",
  description: "봇 테스트",

  async execute(interaction) {
    await interaction.reply("봇 정상 작동");
  }
};