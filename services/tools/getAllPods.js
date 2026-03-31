const { getAllPods } = require("../k8s");

module.exports = async function getAllPodsTool() {
  const pods = await getAllPods();

  if (!pods || pods.length === 0) {
    return {
      ok: true,
      summary: "현재 조회된 Pod가 없습니다.",
      memory: {},
    };
  }

  const lines = pods.slice(0, 25).map((p) => {
    const status = p.displayStatus || p.phase || "Unknown";
    const restartText = Number(p.restarts || 0) > 0 ? `, restarts=${p.restarts}` : "";
    return `- ${p.namespace}/${p.name} (${status}${restartText})`;
  });

  return {
    ok: true,
    summary: [`현재 전체 Pod는 ${pods.length}개입니다.`, "", ...lines].join("\n"),
    memory: {
      lastPod: pods[0]?.name || null,
      lastNamespace: pods[0]?.namespace || null,
      lastIntent: "allPods",
    },
  };
};