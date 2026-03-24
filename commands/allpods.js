const { getAllPods } = require("../services/k8s");

module.exports = {
  name: "allpods",
  description: "전체 Kubernetes Pod 목록 조회",

  async execute(interaction) {
    await interaction.deferReply();

    try {
      const pods = await getAllPods();

      if (!pods || pods.length === 0) {
        return await interaction.editReply("조회된 Pod가 없습니다.");
      }

      const podList = pods
        .map(
          (pod) =>
            `[${pod.namespace}] ${pod.name} | ${pod.phase} | Restarts: ${pod.restarts}`
        )
        .join("\n");

      await interaction.editReply(
        ` **전체 Pod 목록**\n\`\`\`\n${podList.slice(0, 1800)}\n\`\`\``
      );
    } catch (err) {
      console.error("allpods error:", err);
      await interaction.editReply(
        ` 전체 Pod 조회 실패: ${String(err.message).slice(0, 1500)}`
      );
    }
  },
};