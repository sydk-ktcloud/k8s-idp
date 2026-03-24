const axios = require("axios");
const { getProblemPods, getAllPods } = require("./k8s");

async function queryPrometheus(query) {
  const baseUrl = process.env.PROMETHEUS_URL;

  const response = await axios.get(`${baseUrl}/api/v1/query`, {
    params: { query },
    timeout: 5000,
  });

  if (response.data.status !== "success") {
    throw new Error("Prometheus query failed");
  }

  return response.data.data.result;
}

function safeNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function getClusterStatus() {
  const upResult = await queryPrometheus("up");
  const cpuResult = await queryPrometheus(
    '100 - (avg by(instance)(rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)'
  );
  const memResult = await queryPrometheus(
    '(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100'
  );

  const allPods = await getAllPods();
  const problemPods = await getProblemPods();

  const runningPods = allPods.filter((p) => p.phase === "Running").length;
  const problemCount = problemPods.length;

  const avgCpu =
    cpuResult.length > 0
      ? (
          cpuResult.reduce((sum, item) => sum + safeNumber(item.value?.[1]), 0) /
          cpuResult.length
        ).toFixed(1)
      : "N/A";

  const avgMem =
    memResult.length > 0
      ? (
          memResult.reduce((sum, item) => sum + safeNumber(item.value?.[1]), 0) /
          memResult.length
        ).toFixed(1)
      : "N/A";

  const exampleProblems =
    problemPods.length > 0
      ? problemPods
          .slice(0, 5)
          .map((p) => `- ${p.namespace}/${p.name} (${p.displayStatus || p.phase})`)
          .join("\n")
      : "- 없음";

  return [
    "Kubernetes Cluster Status",
    "",
    `🟢 Prometheus 연결: 정상`,
    `🟢 Up 대상 개수: ${upResult.length}`,
    `🟡 Running Pod: ${runningPods}`,
    `🔴 Problem Pod: ${problemCount}`,
    "",
    `CPU 사용률: ${avgCpu}%`,
    `Memory 사용률: ${avgMem}%`,
    "",
    "문제 Pod 예시:",
    exampleProblems,
  ].join("\n");
}

module.exports = {
  getClusterStatus,
};