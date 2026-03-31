const { getProblemPods } = require("../k8s");

module.exports = async function getProblemPodsTool() {
  const pods = await getProblemPods();

  if (!pods || pods.length === 0) {
    return {
      ok: true,
      summary: "현재 비정상 Pod는 없습니다.",
      memory: {},
    };
  }

  const lines = pods.slice(0, 20).map((p) => {
    const status = p.displayStatus || p.phase || "Unknown";
    const restartText = Number(p.restarts || 0) > 0 ? `, restarts=${p.restarts}` : "";
    return `- ${p.namespace}/${p.name} (${status}${restartText})`;
  });

  return {
    ok: true,
    summary: [`현재 문제 있는 Pod는 ${pods.length}개입니다.`, "", ...lines].join("\n"),
    memory: {
      lastPod: pods[0]?.name || null,
      lastNamespace: pods[0]?.namespace || null,
      lastIntent: "pods",
    },
  };
};