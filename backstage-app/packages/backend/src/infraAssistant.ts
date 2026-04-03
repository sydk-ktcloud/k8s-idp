import { createBackendPlugin, coreServices } from '@backstage/backend-plugin-api';
import express from 'express';

const DEFAULT_MODEL = 'gpt-4.1-mini';
const DEFAULT_API_VERSION = '2024-12-01-preview';
const REQUEST_TIMEOUT_MS = 10000;

const infraAssistantPlugin = createBackendPlugin({
  pluginId: 'infra-assistant',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
      },
      async init({ httpRouter, logger }) {
        const router = express.Router();

        router.use(express.json());

        httpRouter.addAuthPolicy({
          path: '/chat',
          allow: 'unauthenticated',
        });

        router.post('/chat', async (req, res) => {
          try {
            const { message } = req.body;

            if (!message || typeof message !== 'string') {
              return res.status(400).json({ error: 'message is required' });
            }

            const rawEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
            const apiKey =
              process.env.AZURE_OPENAI_API_KEY || process.env.AZURE_OPENAI_KEY;
            const deployment =
              process.env.AZURE_OPENAI_MODEL || DEFAULT_MODEL;
            const apiVersion =
              process.env.AZURE_OPENAI_API_VERSION || DEFAULT_API_VERSION;

            if (!rawEndpoint) {
              logger.error('[infra-assistant] AZURE_OPENAI_ENDPOINT is missing');
              return res.status(500).json({
                error: 'Infra Assistant 설정이 올바르지 않습니다.',
              });
            }

            if (!apiKey) {
              logger.error('[infra-assistant] AZURE_OPENAI_API_KEY is missing');
              return res.status(500).json({
                error: 'Infra Assistant 설정이 올바르지 않습니다.',
              });
            }

            const endpoint = rawEndpoint.replace(/\/+$/, '');
            const url =
              `${endpoint}/openai/deployments/${deployment}/chat/completions` +
              `?api-version=${apiVersion}`;

            logger.info('[infra-assistant] Azure request start');
            logger.info(`[infra-assistant] endpoint: ${endpoint}`);
            logger.info(`[infra-assistant] deployment: ${deployment}`);
            logger.info(`[infra-assistant] apiVersion: ${apiVersion}`);

            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

            let azureResponse: Response;
            try {
              azureResponse = await fetch(url, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'api-key': apiKey.trim(),
                },
                signal: controller.signal,
                body: JSON.stringify({
                  messages: [
                    {
                      role: 'system',
                      content: [
                        'You are Infra Assistant inside a Backstage-based Kubernetes IDP.',
                        'Answer in Korean by default.',
                        'Be concise, practical, and helpful.',
                        'Focus on Kubernetes, Backstage, ArgoCD, Grafana, Vault, cluster troubleshooting, and developer platform guidance.',
                        'If the user asks about provisioning or usage flow, explain step by step.',
                        'If you are unsure, clearly say what is uncertain.',
                      ].join(' '),
                    },
                    {
                      role: 'user',
                      content: message,
                    },
                  ],
                  temperature: 0.2,
                  max_tokens: 700,
                }),
              });
            } finally {
              clearTimeout(timeout);
            }

            logger.info(
              `[infra-assistant] Azure status: ${azureResponse.status}`,
            );

            if (!azureResponse.ok) {
              logger.warn(
                `[infra-assistant] Azure request failed with status ${azureResponse.status}`,
              );

              return res.status(502).json({
                error: 'Infra Assistant 요청 처리에 실패했습니다.',
              });
            }

            let data: any;
            try {
              data = await azureResponse.json();
            } catch (parseError) {
              logger.error(
                `[infra-assistant] JSON parse error: ${String(parseError)}`,
              );
              return res.status(500).json({
                error: 'Infra Assistant 응답 처리 중 오류가 발생했습니다.',
              });
            }

            const reply =
              data?.choices?.[0]?.message?.content?.trim() ||
              '응답을 받았지만 내용이 비어 있습니다.';

            return res.json({ reply });
          } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
              logger.error('[infra-assistant] Azure request timeout');
              return res.status(504).json({
                error: '응답 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.',
              });
            }

            const errorMessage =
              error instanceof Error ? error.message : String(error);

            logger.error(`[infra-assistant] unexpected error: ${errorMessage}`);

            return res.status(500).json({
              error: 'Infra Assistant 요청 처리 중 오류가 발생했습니다.',
            });
          }
        });

        httpRouter.use(router);

        logger.info('infra-assistant loaded');
      },
    });
  },
});

export default infraAssistantPlugin;