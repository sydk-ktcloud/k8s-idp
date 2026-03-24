module.exports = {
  name: "help",
  description: "Show available commands and usage",

  async execute(interaction) {
    const helpMessage = `
 **ChatOps Bot 사용 방법**

 **/pods**
비정상 Kubernetes Pod 목록 조회
예: \`/pods\`

 **/allpods**
전체 Kubernetes Pod 목록 조회
예: \`/allpods\`

 **/logs**
Pod 로그 조회
- namespace 자동완성 지원
- pod 자동완성 지원
예: \`/logs namespace:vault pod:vault-0\`

 **/analyze**
AI 기반 Pod 로그 분석
- namespace 자동완성 지원
- pod 자동완성 지원
예: \`/analyze namespace:vault pod:vault-2\`

 **/status**
시스템 상태 확인
예: \`/status\`

 **/ping**
봇 응답 확인
예: \`/ping\`

 **사용 팁**
- \`/logs\`, \`/analyze\`는 먼저 **namespace**를 선택하면 해당 namespace의 **pod 목록이 자동완성**됩니다.
- 장애 분석은 \`CrashLoopBackOff\`, \`Error\` 상태 Pod에서 특히 유용합니다.
`;

    await interaction.reply(helpMessage);
  },
};