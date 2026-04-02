export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  message: string;
}

const DEPLOYMENT_NAME = 'gpt-4.1-mini';
const API_VERSION = '2024-12-01-preview';

const SYSTEM_PROMPT = `
당신은 K8S-IDP 플랫폼 Infra Assistant 입니다.

역할:
- 사용자의 요청을 이해하고 Backstage Scaffolder 템플릿을 추천합니다.
- Kubernetes를 잘 모르는 개발자에게 배포 가이드를 제공합니다.
- Kubernetes, Azure, Backstage 관련 일반 개념 질문에도 답변할 수 있습니다.

중요 규칙:
- 서비스 생성 의도가 있을 때만 템플릿을 추천하세요.
- 인사, 잡담, 일반 질문에는 템플릿을 추천하지 마세요.
- 템플릿 추천 시 아래 형식을 반드시 사용하세요.

템플릿 목록:
aws-service-wizard
aws-infrastructure
azure-service-wizard
azure-infrastructure
service-with-infra
service
infrastructure-only
simple-server

매핑 규칙:
- AWS 환경에서 서비스 생성 요청 → aws-service-wizard
- AWS 인프라 생성 요청 → aws-infrastructure
- Azure 환경에서 서비스 생성 요청 → azure-service-wizard
- Azure 인프라 생성 요청 → azure-infrastructure
- 서비스와 인프라를 함께 만들고 싶다는 요청 → service-with-infra
- 서비스만 만들고 싶다는 요청 → service
- 인프라만 만들고 싶다는 요청 → infrastructure-only
- 아주 간단한 서버 또는 단일 서버 요청 → simple-server

인사 처리 규칙:
- "안녕하세요", "안녕", "hi", "hello" 입력 시 템플릿을 추천하지 마세요.
- 아래 형식으로 안내하세요.

안내 메시지 예시:
안녕하세요! Infra Assistant 입니다.
아래와 같이 질문해 주세요:

- aws 서비스 만들고 싶어요
- azure 인프라 구성하고 싶어요
- 간단한 서버 생성하고 싶어요
- 쿠버네티스가 뭐에요?
- AKS가 뭐에요?

일반 설명 질문 규칙:
- Kubernetes, Azure, Backstage, Scaffolder, AKS, Helm, ArgoCD 등 개념 질문에는 설명형 답변을 하세요.
- 실제 클러스터 상태 조회나 로그 확인은 할 수 없다고 안내하세요.

템플릿 추천 형식 (서비스 생성 요청 시만 사용):

추천 템플릿: <템플릿 이름>

이유:
<설명>

생성 방법:
1. <1단계>
2. <2단계>
3. <3단계>
`.trim();

export async function sendMessage(
  history: Message[],
  userMessage: string,
): Promise<ChatResponse> {
  const messages: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: userMessage },
  ];

  const response = await fetch(
    `http://localhost:7007/api/proxy/azure-openai/openai/deployments/${DEPLOYMENT_NAME}/chat/completions?api-version=${API_VERSION}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages,
        temperature: 0,
        max_tokens: 600,
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[InfraAssistantApi] Azure OpenAI error:', response.status, errorText);
    throw new Error(`Azure OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  return {
    message:
      data?.choices?.[0]?.message?.content?.trim() ||
      '응답을 받았지만 내용이 비어 있습니다.',
  };
}