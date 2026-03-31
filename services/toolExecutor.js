const tools = require("./tools");

async function executeTool(toolName, args = {}) {
  const tool = tools[toolName];

  if (!tool) {
    return {
      ok: false,
      summary: `알 수 없는 tool입니다: ${toolName}`,
      memory: {},
    };
  }

  try {
    console.log("[toolExecutor] start:", toolName, args);

    const result = await tool(args);

    console.log("[toolExecutor] done:", toolName, {
      ok: result?.ok,
      hasSummary: !!result?.summary,
      memory: result?.memory || {},
    });

    return result;
  } catch (error) {
    console.error("[toolExecutor] 실행 오류:", error);
    return {
      ok: false,
      summary: `tool 실행 중 오류가 발생했습니다: ${error.message}`,
      memory: {},
    };
  }
}

module.exports = {
  executeTool,
};