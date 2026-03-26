const { getLogs } = require("../services/logs");
const { getNamespaces, getPodsByNamespace } = require("../services/k8s");

module.exports = {
  name: "logs",
  description: "Get Kubernetes pod logs",
  options: [
    {
      name: "namespace",
      type: 3,
      description: "Namespace",
      required: true,
      autocomplete: true,
    },
    {
      name: "pod",
      type: 3,
      description: "Pod name",
      required: true,
      autocomplete: true,
    },
  ],

  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);

    try {
      if (focusedOption.name === "namespace") {
        const namespaces = await getNamespaces();

        const filtered = namespaces
          .filter((ns) =>
            ns.toLowerCase().includes((focusedOption.value || "").toLowerCase())
          )
          .slice(0, 25);

        return await interaction.respond(
          filtered.map((ns) => ({
            name: ns,
            value: ns,
          }))
        );
      }

      if (focusedOption.name === "pod") {
        const namespace = interaction.options.getString("namespace");

        if (!namespace || !namespace.trim()) {
          return await interaction.respond([]);
        }

        const pods = await getPodsByNamespace(namespace);

        const filtered = pods
          .filter((pod) =>
            pod.name.toLowerCase().includes((focusedOption.value || "").toLowerCase())
          )
          .slice(0, 25);

        return await interaction.respond(
          filtered.map((pod) => ({
            name: `${pod.name} (${pod.phase})`,
            value: pod.name,
          }))
        );
      }

      return await interaction.respond([]);
    } catch (error) {
      console.error("logs autocomplete error:", error.message);
      return await interaction.respond([]);
    }
  },

  async execute(interaction) {
    await interaction.deferReply();

    const namespace = interaction.options.getString("namespace");
    const pod = interaction.options.getString("pod");

    try {
      const logs = await getLogs(pod, namespace);

      const reply = ` **Logs for ${pod}**
**Namespace:** ${namespace}

\`\`\`
${logs.slice(0, 1700)}
\`\`\``;

      await interaction.editReply(reply);
    } catch (error) {
      console.error("logs command error:", error.message);
      await interaction.editReply(
        ` 로그 조회 실패: ${String(error.message).slice(0, 1800)}`
      );
    }
  },
};