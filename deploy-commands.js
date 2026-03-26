require("dotenv").config();

const { REST, Routes, SlashCommandBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

const commands = [];

const commandsPath = path.join(__dirname, "commands");
const commandFiles = fs
  .readdirSync(commandsPath)
  .filter((file) => file.endsWith(".js"));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));

  const slashCommand = new SlashCommandBuilder()
    .setName(command.name)
    .setDescription(command.description);

  commands.push(slashCommand.toJSON());
}

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log("슬래시 명령어 등록 시작...");

    await rest.put(
      Routes.applicationGuildCommands(
        process.env.CLIENT_ID,
        process.env.GUILD_ID
      ),
      { body: commands }
    );

    console.log("슬래시 명령어 등록 완료");
  } catch (error) {
    console.error("슬래시 명령어 등록 오류:", error);
  }
})();