const { getLogs } = require("../services/logs");
const { analyzeLogs } = require("../services/gpt");
const {
  getNamespaces,
  getAllPods,
  getProblemPods,
} = require("../services/k8s");

function getSelectedNamespace(interaction) {
  try {
    const direct = interaction.options.getString("namespace");
    if (direct && String(direct).trim()) {
      return String(direct).trim();
    }
  } catch (_) {}

  const raw = Array.isArray(interaction.options?.data)
    ? interaction.options.data.find((opt) => opt.name === "namespace")
    : null;

  if (raw?.value) {
    return String(raw.value).trim();
  }

  return "";
}

module.exports = {
  name: "analyze",
  description: "Analyze Kubernetes pod logs with AI",
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
      // namespace 자동완성
      if (focusedOption.name === "namespace") {
        const namespaces = (await getNamespaces()) || [];

        const filtered = namespaces
          .filter((ns) =>
            ns.toLowerCase().includes(String(focusedOption.value || "").toLowerCase())
          )
          .slice(0, 25);

        console.log("[analyze autocomplete] namespace total:", namespaces.length);
        console.log("[analyze autocomplete] namespace filtered:", filtered.length);

        return await interaction.respond(
          filtered.map((ns) => ({
            name: ns,
            value: ns,
          }))
        );
      }

      // pod 자동완성
      if (focusedOption.name === "pod") {
        const namespace = getSelectedNamespace(interaction);
        const keyword = String(focusedOption.value || "").toLowerCase().trim();

        console.log("[analyze autocomplete] selected namespace:", namespace);
        console.log("[analyze autocomplete] pod keyword:", keyword);

        if (!namespace) {
          return await interaction.respond([]);
        }

        // 안정성을 위해 getPodsByNamespace 대신 getAllPods 사용
        const allPods = (await getAllPods()) || [];
        const allProblemPods = (await getProblemPods()) || [];

        const podsInNamespace = allPods.filter(
          (pod) => String(pod.namespace || "") === namespace
        );

        const problemMap = new Map(
          allProblemPods
            .filter((pod) => String(pod.namespace || "") === namespace)
            .map((pod) => [
              pod.name,
              {
                name: pod.name,
                phase: pod.displayStatus || pod.phase || "Unknown",
                isProblem: true,
              },
            ])
        );

        const merged = podsInNamespace.map((pod) => {
          const problem = problemMap.get(pod.name);

          return {
            name: pod.name,
            phase: problem?.phase || pod.displayStatus || pod.phase || "Unknown",
            isProblem: !!problem,
          };
        });

        const filtered = merged
          .filter((pod) =>
            pod.name.toLowerCase().includes(keyword)
          )
          .sort((a, b) => {
            // 문제 파드 먼저
            if (a.isProblem !== b.isProblem) {
              return a.isProblem ? -1 : 1;
            }

            // 이름순
            return a.name.localeCompare(b.name);
          })
          .slice(0, 25);

        console.log("[analyze autocomplete] pods in namespace:", podsInNamespace.length);
        console.log("[analyze autocomplete] problem pods:", problemMap.size);
        console.log("[analyze autocomplete] filtered pods:", filtered.length);

        return await interaction.respond(
          filtered.map((pod) => ({
            name: pod.isProblem
              ? `[문제] ${pod.name} (${pod.phase})`
              : `${pod.name} (${pod.phase})`,
            value: pod.name,
          }))
        );
      }

      return await interaction.respond([]);
    } catch (error) {
      console.error("analyze autocomplete error:", error);
      try {
        return await interaction.respond([]);
      } catch (_) {
        return;
      }
    }
  },

  async execute(interaction) {
    await interaction.deferReply();

    const namespace = interaction.options.getString("namespace");
    const pod = interaction.options.getString("pod");

    try {
      if (!namespace || !pod) {
        return await interaction.editReply("namespace와 pod를 모두 선택해주세요.");
      }

      const logs = await getLogs(pod, namespace);

      if (!logs || !logs.trim()) {
        return await interaction.editReply(
          `로그가 비어 있습니다.\nNamespace: ${namespace}\nPod: ${pod}`
        );
      }

      const analysis = await analyzeLogs(logs);

      const reply = `**AI Analysis for ${pod}**
**Namespace:** ${namespace}

${analysis}`;

      await interaction.editReply(reply.slice(0, 1900));
    } catch (err) {
      console.error("analyze command error:", err);
      await interaction.editReply(
        `분석 실패: ${String(err?.message || err).slice(0, 1800)}`
      );
    }
  },
};