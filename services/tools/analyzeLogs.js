const { analyzeLogs } = require("../gpt");
const getLogsTool = require("./getLogs");

module.exports = async function analyzeLogsTool(args = {}) {
  const logResult = await getLogsTool(args);

  if (!logResult.ok) {
    return logResult;
  }

  const logs = logResult.raw?.logs;

  if (!logs || !logs.trim()) {
    return {
      ok: true,
      summary: "분석할 로그가 없습니다.",
      memory: logResult.memory || {},
    };
  }

  const analysis = await analyzeLogs(logs);

  return {
    ok: true,
    summary: `로그 분석 결과\n\n${analysis}`,
    memory: {
      ...(logResult.memory || {}),
      lastIntent: "analyze",
      lastResultSummary: String(analysis).slice(0, 300),
    },
  };
};