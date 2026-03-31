const { queryPrometheusScalar } = require("../prometheus");

module.exports = async function serviceMetricsTool(args = {}) {
  const { service, namespace } = args;

  if (!service) {
    return {
      ok: false,
      summary: "서비스 이름이 필요합니다.",
      memory: {},
    };
  }

  const nsRegex = namespace ? `${namespace}` : ".*";

  const cpuQuery = `
sum(rate(container_cpu_usage_seconds_total{
  container!="",
  image!="",
  namespace=~"${nsRegex}",
  pod=~".*${service}.*"
}[5m])) * 1000
  `.trim();

  const memQuery = `
sum(container_memory_usage_bytes{
  container!="",
  image!="",
  namespace=~"${nsRegex}",
  pod=~".*${service}.*"
}) / 1024 / 1024
  `.trim();

  let cpu = null;
  let mem = null;

  try {
    cpu = await queryPrometheusScalar(cpuQuery);
  } catch (_) {}

  try {
    mem = await queryPrometheusScalar(memQuery);
  } catch (_) {}

  return {
    ok: true,
    summary: [
      `${service.toUpperCase()} 메트릭`,
      "",
      `CPU 사용량: ${cpu !== null ? `${cpu.toFixed(0)}m` : "N/A"}`,
      `Memory 사용량: ${mem !== null ? `${mem.toFixed(1)} MiB` : "N/A"}`,
    ].join("\n"),
    memory: {
      lastService: service,
      lastNamespace: namespace || null,
      lastIntent: "service_metrics",
    },
  };
};