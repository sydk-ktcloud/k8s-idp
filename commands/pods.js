const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { getProblemPods } = require("../services/k8s");

const getStatusIcon = (status) => {
  if (status === "Running") return "🟢";
  if (status === "Succeeded") return "🔵";
  if (status === "Pending") return "🟡";

  if (
    status.includes("CrashLoop") ||
    status.includes("Error") ||
    status.includes("BackOff")
  ) {
    return "🔴";
  }

  return "⚪";
};

module.exports = {
  name: "pods",
  description: "비정상 Kubernetes Pod 목록 조회",

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const pods = await getProblemPods();

      if (!pods || pods.length === 0) {
        return await interaction.editReply(" 비정상 Pod가 없습니다.");
      }

      const podList = pods
        .map(
          (pod) =>
            `${getStatusIcon(pod.phase)} [${pod.namespace}] ${pod.name} | ${pod.phase} | Issue: ${pod.issue}`
        )
        .join("\n");

    
      const buttonTargets = pods
        .filter((pod) => {
          const customId = `analyze|${pod.namespace}|${pod.name}`;
          return customId.length <= 100;
        })
        .slice(0, 5);

      const components = [];

      if (buttonTargets.length > 0) {
        const row = new ActionRowBuilder().addComponents(
          buttonTargets.map((pod) =>
            new ButtonBuilder()
              .setCustomId(`analyze|${pod.namespace}|${pod.name}`)
              .setLabel(`${pod.namespace}/${pod.name}`.slice(0, 80))
              .setStyle(ButtonStyle.Primary)
          )
        );

        components.push(row);
      }

const count = pods.length;

await interaction.editReply({
  content:
    ` 비정상 Pod ${count}개 발견\n\`\`\`\n${podList.slice(0, 1800)}\n\`\`\`\n` +
    `아래 버튼을 누르면 해당 Pod를 바로 AI 분석합니다.`,
  components,
});
    } catch (error) {
      console.error("비정상 Pod 조회 실패:", error.message);
      await interaction.editReply(" 비정상 Pod 조회 실패");
    }
  },
};