const { chatWithAI } = require("../gpt");

module.exports = async function generalChatTool(args = {}) {
  const message = args.message || "";

  const blockedOpsKeywords =
    /secret|시크릿|eso|external secret|vault|argocd|sync|synced|상태|연동|템플릿|template|로그|메트릭|pod|파드|네임스페이스|namespace/i;

  if (blockedOpsKeywords.test(message)) {
    return {
      ok: true,
      summary:
        "이 질문은 실제 클러스터 조회 또는 플랫폼 설명용 tool로 처리하는 것이 더 적절합니다. 아직 해당 질문용 tool이 연결되지 않았거나 라우팅되지 않았습니다.",
      memory: {
        lastIntent: "general_chat_blocked",
      },
    };
  }

  const reply = await chatWithAI(message);

  return {
    ok: true,
    summary: reply,
    memory: {
      lastIntent: "chat",
    },
  };
};