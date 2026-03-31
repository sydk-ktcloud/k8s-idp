const { findPodsByService } = require("../k8s");

module.exports = async function findNamespaceTool(args = {}) {
  const { service } = args;

  if (!service) {
    return {
      ok: false,
      summary: "서비스 이름이 필요합니다.",
      memory: {},
    };
  }

  const pods = await findPodsByService(service);
  const namespaces = Array.from(new Set((pods || []).map((p) => p.namespace))).sort(
    (a, b) => a.localeCompare(b)
  );

  if (namespaces.length === 0) {
    return {
      ok: true,
      summary: `${service} 관련 namespace를 찾지 못했습니다.`,
      memory: {
        lastService: service,
      },
    };
  }

  if (namespaces.length === 1) {
    return {
      ok: true,
      summary: `${service}는 ${namespaces[0]} 네임스페이스에 있습니다.`,
      memory: {
        lastService: service,
        lastNamespace: namespaces[0],
        lastIntent: "findNamespace",
      },
    };
  }

  return {
    ok: true,
    summary: [
      `${service} 관련 namespace는 여러 개입니다.`,
      "",
      ...namespaces.map((ns) => `- ${ns}`),
    ].join("\n"),
    memory: {
      lastService: service,
      lastNamespace: namespaces[0] || null,
      lastIntent: "findNamespace",
    },
  };
};