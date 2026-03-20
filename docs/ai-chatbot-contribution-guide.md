# Backstage AI Infra Chatbot - 기여자 가이드

> **담당자**: AI 개발자
> **목적**: K8S-IDP Backstage 포털에 Azure OpenAI 기반 인프라 가이드 챗봇 추가

---

## 1. 목적 및 배경

### 챗봇의 역할

인프라 지식이 없는 개발자가 K8S-IDP 플랫폼에서 서비스를 프로비저닝할 때, 단계별 가이드를 제공하는 AI 어시스턴트입니다.

**문제**: 신규 개발자가 Kubernetes, ArgoCD, Helm 등의 개념을 먼저 익혀야 Backstage Scaffolder를 활용할 수 있음
**해결**: 챗봇이 "서비스 배포하고 싶어요" → "Scaffolder 템플릿으로 이렇게 하세요" 수준의 안내를 제공

### K8S-IDP 플랫폼 구성

| 컴포넌트 | 역할 | 접근 경로 |
|---|---|---|
| Backstage | 개발자 포털 (현재 플러그인 추가 대상) | NodePort 30007 |
| ArgoCD | GitOps 배포 자동화 | NodePort 30081 |
| Grafana | 모니터링 대시보드 | NodePort 30080 |
| Cilium + Hubble | 네트워크 관측성 | NodePort 30072 |
| Scaffolder | 새 서비스/리소스 생성 템플릿 | Backstage 내 |

---

## 2. 기술 스택

| 항목 | 선택 | 이유 |
|---|---|---|
| AI 백엔드 | Azure OpenAI (GPT-4o) | Azure 크레딧 활용, 엔터프라이즈 SLA |
| 프론트엔드 | Backstage Custom Plugin (React 18 + MUI 4.x) | 플랫폼 네이티브 통합 |
| API 보안 | Backstage proxy-backend | API Key 브라우저 노출 방지 |
| 상태 관리 | React useState + sessionStorage | 별도 상태관리 라이브러리 불필요 |

### 아키텍처 흐름

```
[Developer Browser]
      │
      │ (React UI)
      ▼
[Backstage Frontend Plugin: infra-assistant]
      │
      │ HTTP POST /api/proxy/azure-openai/openai/deployments/<MODEL>/chat/completions
      ▼
[Backstage Backend: proxy-backend]
      │
      │ api-key 헤더 주입 (환경변수에서 읽음, 브라우저 비노출)
      ▼
[Azure OpenAI API - GPT-4o]
```

**proxy-backend 사용의 장점**:
- API Key가 프론트엔드 번들에 포함되지 않음
- 별도 백엔드 플러그인 작성 불필요 (`app-config.yaml` 설정만으로 충분)
- `@backstage/plugin-proxy-backend`는 이미 설치 및 등록된 상태

---

## 3. 현재 Backstage 상태

| 항목 | 내용 |
|---|---|
| Backstage 버전 | 최신 (createBackend 패턴) |
| 패키지 매니저 | Yarn 4.4.1 (workspaces) |
| 인증 | OIDC/Dex SSO (production) |
| DB | PostgreSQL (production) |
| 커스텀 플러그인 | **없음** (`plugins/` 디렉토리 비어있음 → 신규 생성 필요) |
| proxy-backend | **설치됨** (`@backstage/plugin-proxy-backend`) |

---

## 4. 디렉토리 구조

플러그인 생성 후 목표 구조:

```
backstage-app/
├── app-config.yaml                          # proxy 설정 추가 필요
├── app-config.production.yaml               # production proxy 추가 필요
├── packages/
│   ├── app/
│   │   ├── package.json                     # infra-assistant 의존성 추가 필요
│   │   └── src/
│   │       ├── App.tsx                      # 라우트 추가 필요
│   │       └── components/Root/Root.tsx     # 사이드바 메뉴 추가 필요
│   └── backend/
│       └── src/index.ts                     # 수정 불필요 (proxy-backend 이미 등록됨)
└── plugins/
    └── infra-assistant/                     # 신규 생성
        ├── package.json
        └── src/
            ├── index.ts                     # plugin export
            ├── plugin.ts                    # plugin 정의
            ├── components/
            │   ├── ChatPage/
            │   │   ├── ChatPage.tsx         # 메인 채팅 UI (전체 페이지)
            │   │   └── index.ts
            │   └── ChatWidget/
            │       ├── ChatWidget.tsx       # 사이드바 플로팅 위젯 (선택)
            │       └── index.ts
            └── api/
                ├── InfraAssistantApi.ts     # Azure OpenAI 클라이언트
                └── index.ts
```

---

## 5. 구현 단계 (Step-by-step)

### Step 1: Backstage Plugin 스캐폴딩

```bash
cd backstage-app
yarn backstage-cli new --select plugin
# 프롬프트에서 입력:
# ? Enter the ID of the plugin [required] infra-assistant
```

생성된 플러그인의 기본 파일들을 확인하고 불필요한 예제 코드를 제거합니다.

---

### Step 2: app-config.yaml에 proxy 설정 추가

`backstage-app/app-config.yaml`에 다음을 추가합니다:

```yaml
proxy:
  endpoints:
    /azure-openai:
      target: https://${AZURE_OPENAI_RESOURCE_NAME}.openai.azure.com
      changeOrigin: true
      headers:
        api-key: ${AZURE_OPENAI_API_KEY}
      # 선택: CORS 허용 경로 제한
      allowedHeaders:
        - Content-Type
```

`backstage-app/app-config.production.yaml`에도 동일하게 추가합니다 (환경변수는 동일하게 사용).

> **보안 주의**: `api-key` 값을 직접 파일에 작성하지 마세요. 반드시 `${AZURE_OPENAI_API_KEY}` 형태의 환경변수 참조를 사용하세요.

---

### Step 3: Azure OpenAI API 클라이언트 구현

`plugins/infra-assistant/src/api/InfraAssistantApi.ts`:

```typescript
export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  message: string;
  error?: string;
}

const SYSTEM_PROMPT = `당신은 K8S-IDP 플랫폼의 인프라 가이드 어시스턴트입니다.
개발자들이 Kubernetes 인프라 프로비저닝을 쉽게 할 수 있도록 돕습니다.

플랫폼 구성:
- Backstage: 개발자 포털 (현재 접속 중인 곳)
- ArgoCD: GitOps 배포 자동화 시스템 (포트 30081)
- Grafana: 모니터링 대시보드 (포트 30080)
- Cilium + Hubble: 네트워크 관측성 (포트 30072)
- Scaffolder 템플릿: 새 서비스 생성 자동화 도구

주요 안내 사항:
1. 새 서비스 배포 → Backstage Scaffolder 템플릿 사용 안내
2. 배포 상태 확인 → ArgoCD 접속 방법 안내
3. 모니터링 설정 → Grafana 대시보드 안내
4. 네트워크 정책 → Cilium NetworkPolicy 설명

답변 규칙:
1. 기술 용어는 쉬운 말로 먼저 설명한 후 원어를 병기
2. 모든 안내는 번호가 있는 단계별 목록으로 제공
3. Backstage Scaffolder 템플릿으로 해결 가능한 경우 우선 안내
4. 모르는 내용은 "확인이 필요합니다"라고 솔직하게 답변
5. 답변은 한국어로 제공`;

export async function sendMessage(
  history: Message[],
  userMessage: string,
  modelDeploymentName: string = 'gpt-4o',
  apiVersion: string = '2024-02-01',
): Promise<ChatResponse> {
  const messages: Message[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: userMessage },
  ];

  const endpoint = `/api/proxy/azure-openai/openai/deployments/${modelDeploymentName}/chat/completions?api-version=${apiVersion}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messages,
      max_tokens: 1000,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Azure OpenAI API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return {
    message: data.choices[0].message.content,
  };
}
```

`plugins/infra-assistant/src/api/index.ts`:

```typescript
export { sendMessage } from './InfraAssistantApi';
export type { Message, ChatResponse } from './InfraAssistantApi';
```

---

### Step 4: ChatPage 컴포넌트 구현

`plugins/infra-assistant/src/components/ChatPage/ChatPage.tsx`:

```typescript
import React, { useState, useRef, useEffect } from 'react';
import {
  Box,
  TextField,
  Button,
  Paper,
  Typography,
  CircularProgress,
  makeStyles,
} from '@material-ui/core';
import SendIcon from '@material-ui/icons/Send';
import { sendMessage, Message } from '../../api';

const useStyles = makeStyles(theme => ({
  root: {
    height: 'calc(100vh - 120px)',
    display: 'flex',
    flexDirection: 'column',
    padding: theme.spacing(2),
  },
  messagesContainer: {
    flex: 1,
    overflowY: 'auto',
    marginBottom: theme.spacing(2),
    padding: theme.spacing(1),
  },
  messageBubble: {
    maxWidth: '75%',
    padding: theme.spacing(1.5),
    borderRadius: theme.spacing(1),
    marginBottom: theme.spacing(1),
    wordBreak: 'break-word',
    whiteSpace: 'pre-wrap',
  },
  userBubble: {
    backgroundColor: theme.palette.primary.main,
    color: theme.palette.primary.contrastText,
    marginLeft: 'auto',
  },
  assistantBubble: {
    backgroundColor: theme.palette.grey[100],
    color: theme.palette.text.primary,
  },
  inputContainer: {
    display: 'flex',
    gap: theme.spacing(1),
  },
}));

const SESSION_KEY = 'infra-assistant-history';

export const ChatPage = () => {
  const classes = useStyles();
  const [history, setHistory] = useState<Message[]>(() => {
    try {
      const saved = sessionStorage.getItem(SESSION_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history]);

  useEffect(() => {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(history));
  }, [history]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();
    setInput('');
    setError(null);

    const newHistory: Message[] = [...history, { role: 'user', content: userMessage }];
    setHistory(newHistory);
    setLoading(true);

    try {
      const response = await sendMessage(history, userMessage);
      setHistory([...newHistory, { role: 'assistant', content: response.message }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Box className={classes.root}>
      <Typography variant="h5" gutterBottom>
        인프라 가이드 어시스턴트
      </Typography>

      <Paper variant="outlined" className={classes.messagesContainer}>
        {history.length === 0 && (
          <Typography variant="body2" color="textSecondary" align="center" style={{ marginTop: 16 }}>
            안녕하세요! 인프라 관련 질문을 자유롭게 해주세요.{'\n'}
            예: "새 서비스를 배포하고 싶어요", "ArgoCD는 어떻게 쓰나요?"
          </Typography>
        )}
        {history.map((msg, idx) => (
          <Box
            key={idx}
            display="flex"
            justifyContent={msg.role === 'user' ? 'flex-end' : 'flex-start'}
          >
            <Paper
              className={`${classes.messageBubble} ${
                msg.role === 'user' ? classes.userBubble : classes.assistantBubble
              }`}
            >
              <Typography variant="body2">{msg.content}</Typography>
            </Paper>
          </Box>
        ))}
        {loading && (
          <Box display="flex" justifyContent="flex-start" alignItems="center" mt={1}>
            <CircularProgress size={20} style={{ marginRight: 8 }} />
            <Typography variant="body2" color="textSecondary">
              답변 생성 중...
            </Typography>
          </Box>
        )}
        {error && (
          <Typography variant="body2" color="error" style={{ marginTop: 8 }}>
            오류: {error}
          </Typography>
        )}
        <div ref={messagesEndRef} />
      </Paper>

      <Box className={classes.inputContainer}>
        <TextField
          fullWidth
          multiline
          maxRows={4}
          variant="outlined"
          size="small"
          placeholder="질문을 입력하세요... (Shift+Enter: 줄바꿈, Enter: 전송)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
        />
        <Button
          variant="contained"
          color="primary"
          onClick={handleSend}
          disabled={loading || !input.trim()}
          endIcon={<SendIcon />}
        >
          전송
        </Button>
      </Box>
    </Box>
  );
};
```

`plugins/infra-assistant/src/components/ChatPage/index.ts`:

```typescript
export { ChatPage } from './ChatPage';
```

---

### Step 5: Plugin 정의 및 Export

`plugins/infra-assistant/src/plugin.ts`:

```typescript
import { createPlugin, createRoutableExtension } from '@backstage/core-plugin-api';
import { rootRouteRef } from './routes';

export const infraAssistantPlugin = createPlugin({
  id: 'infra-assistant',
  routes: {
    root: rootRouteRef,
  },
});

export const InfraAssistantPage = infraAssistantPlugin.provide(
  createRoutableExtension({
    name: 'InfraAssistantPage',
    component: () =>
      import('./components/ChatPage').then(m => m.ChatPage),
    mountPoint: rootRouteRef,
  }),
);
```

`plugins/infra-assistant/src/routes.ts`:

```typescript
import { createRouteRef } from '@backstage/core-plugin-api';

export const rootRouteRef = createRouteRef({
  id: 'infra-assistant',
});
```

`plugins/infra-assistant/src/index.ts`:

```typescript
export { infraAssistantPlugin, InfraAssistantPage } from './plugin';
```

---

### Step 6: 앱에 플러그인 등록

**`backstage-app/packages/app/package.json`** — 의존성 추가:

```json
{
  "dependencies": {
    "@internal/plugin-infra-assistant": "^0.1.0"
  }
}
```

그 후 `yarn install`을 실행합니다.

**`backstage-app/packages/app/src/App.tsx`** — 라우트 추가:

```typescript
import { InfraAssistantPage } from '@internal/plugin-infra-assistant';

// FlatRoutes 내부에 추가:
<Route path="/infra-assistant" element={<InfraAssistantPage />} />
```

**`backstage-app/packages/app/src/components/Root/Root.tsx`** — 사이드바 메뉴 추가:

```typescript
import SmartToyIcon from '@material-ui/icons/SmartToy';  // 또는 다른 아이콘

// SidebarGroup 내부에 추가:
<SidebarItem icon={SmartToyIcon} to="infra-assistant" text="인프라 어시스턴트" />
```

---

## 6. 시스템 프롬프트 설계

> AI 담당자가 플랫폼 상황에 맞게 **커스터마이징해야 할 핵심 부분**입니다.
> `plugins/infra-assistant/src/api/InfraAssistantApi.ts`의 `SYSTEM_PROMPT` 상수를 수정하세요.

### 현재 초안

```
당신은 K8S-IDP 플랫폼의 인프라 가이드 어시스턴트입니다.
개발자들이 Kubernetes 인프라 프로비저닝을 쉽게 할 수 있도록 돕습니다.

플랫폼 구성:
- Backstage: 개발자 포털 (현재 접속 중인 곳)
- ArgoCD: GitOps 배포 자동화 시스템 (NodePort 30081)
- Grafana: 모니터링 대시보드 (NodePort 30080)
- Cilium + Hubble: 네트워크 관측성 (NodePort 30072)
- Scaffolder 템플릿: 새 서비스 생성 자동화 도구

주요 안내 사항:
1. 새 서비스 배포 → Backstage Scaffolder 템플릿 사용 안내
2. 배포 상태 확인 → ArgoCD 접속 방법 안내
3. 모니터링 설정 → Grafana 대시보드 안내
4. 네트워크 정책 → Cilium NetworkPolicy 설명

답변 규칙:
1. 기술 용어는 쉬운 말로 먼저 설명한 후 원어를 병기
2. 모든 안내는 번호가 있는 단계별 목록으로 제공
3. Backstage Scaffolder 템플릿으로 해결 가능한 경우 우선 안내
4. 모르는 내용은 "확인이 필요합니다"라고 솔직하게 답변
5. 답변은 한국어로 제공
```

### 커스터마이징 권장 사항

- Scaffolder 템플릿 목록 및 사용법을 추가하면 챗봇 정확도가 크게 향상됩니다
- 팀의 Git 저장소 구조, 네이밍 컨벤션 등을 추가하세요
- 자주 묻는 질문(FAQ)을 프롬프트에 예시로 포함하면 일관된 답변을 유도할 수 있습니다
- RAG(검색 증강 생성) 방식으로 확장 시 이 프롬프트를 기반으로 설계하세요

---

## 7. Azure OpenAI 설정 방법

### Azure Portal에서 리소스 생성

1. Azure Portal (portal.azure.com) 접속
2. **Azure OpenAI** 검색 후 **만들기** 클릭
3. 구독, 리소스 그룹, 리전 선택
   - 리전: `East US` 또는 `Sweden Central` 권장 (GPT-4o 가용 리전)
4. 가격 책정 계층: `Standard S0`
5. **검토 + 만들기** → **만들기**

### 모델 배포

1. 생성된 OpenAI 리소스 → **Azure OpenAI Studio** 이동
2. 왼쪽 메뉴 **배포** → **새 배포 만들기**
3. 모델: `gpt-4o` 선택
4. 배포 이름 입력 (예: `gpt-4o`) — **이 이름을 코드에서 사용합니다**
5. **만들기** 클릭

### API Key 및 엔드포인트 확인

1. Azure Portal → OpenAI 리소스 → **키 및 엔드포인트**
2. **키 1** 값 복사 → `AZURE_OPENAI_API_KEY`로 사용
3. **엔드포인트** 값 복사 → 예: `https://my-openai.openai.azure.com`
   - `AZURE_OPENAI_RESOURCE_NAME`은 `my-openai` 부분

---

## 8. Kubernetes Secret 등록

### Secret 생성

```bash
kubectl create secret generic azure-openai-secret \
  --from-literal=AZURE_OPENAI_API_KEY=<실제_API_KEY> \
  --from-literal=AZURE_OPENAI_RESOURCE_NAME=<리소스_이름> \
  -n backstage
```

### Backstage Deployment에 환경변수 주입

`kubernetes/manifests/backstage/deployment.yaml`의 Backstage 컨테이너 spec에 추가:

```yaml
envFrom:
  - secretRef:
      name: azure-openai-secret
```

또는 개별 env 항목으로:

```yaml
env:
  - name: AZURE_OPENAI_API_KEY
    valueFrom:
      secretKeyRef:
        name: azure-openai-secret
        key: AZURE_OPENAI_API_KEY
  - name: AZURE_OPENAI_RESOURCE_NAME
    valueFrom:
      secretKeyRef:
        name: azure-openai-secret
        key: AZURE_OPENAI_RESOURCE_NAME
```

---

## 9. 검증 방법

### 로컬 개발 환경

```bash
cd backstage-app

# 환경변수 설정 후 실행
AZURE_OPENAI_API_KEY=your-key \
AZURE_OPENAI_RESOURCE_NAME=your-resource-name \
yarn dev
```

브라우저에서 `http://localhost:3000/infra-assistant` 접속 후 채팅 테스트.

**proxy 동작 확인**:
- 브라우저 개발자도구 → Network 탭
- `/api/proxy/azure-openai/...` 요청이 Backstage 백엔드를 통해 나가는지 확인
- `api-key` 헤더가 Response에 노출되지 않는지 확인

### 프로덕션 배포

```bash
# 1. Docker 이미지 빌드
cd backstage-app
yarn build:backend
docker build -t backstage:ai-chatbot -f packages/backend/Dockerfile .

# 2. 이미지 업로드 (레지스트리 경로에 맞게 수정)
docker tag backstage:ai-chatbot <registry>/backstage:ai-chatbot
docker push <registry>/backstage:ai-chatbot

# 3. Kubernetes 배포 업데이트
kubectl set image deployment/backstage backstage=<registry>/backstage:ai-chatbot -n backstage
kubectl rollout status deployment/backstage -n backstage
```

---

## 10. 수정이 필요한 파일 목록

| 파일 | 작업 내용 |
|---|---|
| `backstage-app/app-config.yaml` | `proxy.endpoints./azure-openai` 섹션 추가 |
| `backstage-app/app-config.production.yaml` | 동일한 proxy 설정 추가 |
| `backstage-app/packages/app/package.json` | `@internal/plugin-infra-assistant` 의존성 추가 |
| `backstage-app/packages/app/src/App.tsx` | `/infra-assistant` 라우트 추가 |
| `backstage-app/packages/app/src/components/Root/Root.tsx` | 사이드바 메뉴 아이템 추가 |
| `backstage-app/packages/backend/src/index.ts` | **수정 불필요** (proxy-backend 이미 등록됨) |
| `backstage-app/plugins/infra-assistant/` | **신규 생성** (Step 1~5 참고) |
| `kubernetes/manifests/backstage/deployment.yaml` | `envFrom` Secret 참조 추가 |

---

## 11. 자주 발생하는 문제

### proxy 404 오류

```
404 Not Found on /api/proxy/azure-openai/...
```

**원인**: `app-config.yaml`의 proxy 설정이 누락되었거나 백엔드가 재시작되지 않음
**해결**: `yarn dev` 재시작 후 `app-config.yaml` proxy 섹션 확인

### CORS 오류

**원인**: Azure OpenAI 엔드포인트에 직접 요청을 보내는 경우 (proxy를 우회)
**해결**: 반드시 `/api/proxy/azure-openai/...` 경로를 사용할 것

### API Key 인증 실패 (401)

**원인**: 환경변수 `AZURE_OPENAI_API_KEY`가 설정되지 않았거나 잘못된 값
**해결**: `echo $AZURE_OPENAI_API_KEY`로 값 확인, Azure Portal에서 Key 재확인

### 모델을 찾을 수 없음 (404)

**원인**: `modelDeploymentName`이 Azure OpenAI Studio의 배포 이름과 다름
**해결**: Azure OpenAI Studio → 배포 탭에서 정확한 배포 이름 확인 후 코드 수정

---

## 참고 자료

- [Backstage Plugin 개발 가이드](https://backstage.io/docs/plugins/create-a-plugin)
- [Backstage proxy-backend 설정](https://backstage.io/docs/plugins/proxying)
- [Azure OpenAI API 레퍼런스](https://learn.microsoft.com/en-us/azure/ai-services/openai/reference)
- [Azure OpenAI Chat Completions](https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/chatgpt)
