const { findPodsByService } = require("../k8s");

module.exports = async function getServicePodsTool(args = {}) {
  const { service } = args;

  if (!service) {
    return {
      ok: false,
      summary: "특정 서비스 상태를 찾지 못했습니다.",
      memory: {},
    };
  }

  const pods = await findPodsByService(service);

  if (!pods || pods.length === 0) {
    return {
      ok: true,
      summary: `특정 서비스 상태를 찾지 못했습니다.`,
      memory: {
        lastService: service,
      },
    };
  }

  const runningCount = pods.filter(
    (p) => (p.displayStatus || p.phase || "") === "Running"
  ).length;
  const problemCount = pods.length - runningCount;

  const lines = pods.map((p) => {
    const status = p.displayStatus || p.phase || "Unknown";
    const restartText =
      Number(p.restarts || 0) > 0 ? `, restarts=${p.restarts}` : "";
    return `- ${p.namespace}/${p.name} (${status}${restartText})`;
  });

  return {
    ok: true,
    summary: [
      `${service.toUpperCase()} 상태`,
      "",
      `Running: ${runningCount}`,
      `Problem: ${problemCount}`,
      "",
      ...lines,
    ].join("\n"),
    memory: {
      lastService: service,
      lastPod: pods[0]?.name || null,
      lastNamespace: pods[0]?.namespace || null,
      lastIntent: "serviceStatus",
    },
  };
};