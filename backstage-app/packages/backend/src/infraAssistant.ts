import { createBackendPlugin, coreServices } from '@backstage/backend-plugin-api';
import express from 'express';

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
            const apiKey = process.env.AZURE_OPENAI_KEY;
            const deployment = process.env.AZURE_OPENAI_MODEL || 'gpt-4.1-mini';
            const apiVersion = '2024-12-01-preview';

            if (!rawEndpoint) {
              logger.error('[infra-assistant] AZURE_OPENAI_ENDPOINT is missing');
              return res
                .status(500)
                .json({ error: 'AZURE_OPENAI_ENDPOINT is missing' });
            }

            if (!apiKey) {
              logger.error('[infra-assistant] AZURE_OPENAI_KEY is missing');
              return res
                .status(500)
                .json({ error: 'AZURE_OPENAI_KEY is missing' });
            }

            const endpoint = rawEndpoint.replace(/\/+$/, '');
            const url =
              `${endpoint}/openai/deployments/${deployment}/chat/completions` +
              `?api-version=${apiVersion}`;

            const maskedKey =
              apiKey.length > 8
                ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`
                : 'INVALID_KEY_LENGTH';

            logger.info('[infra-assistant] Azure request start');
            logger.info(`[infra-assistant] endpoint: ${endpoint}`);
            logger.info(`[infra-assistant] deployment: ${deployment}`);
            logger.info(`[infra-assistant] apiVersion: ${apiVersion}`);
            logger.info(`[infra-assistant] key: ${maskedKey}`);
            logger.info(`[infra-assistant] incoming message: ${message}`);
            logger.info(`[infra-assistant] url: ${url}`);

            const azureResponse = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'api-key': apiKey.trim(),
              },
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

            const responseText = await azureResponse.text();

            logger.info(
              `[infra-assistant] Azure status: ${azureResponse.status}`,
            );
            logger.info(
              `[infra-assistant] Azure raw response: ${responseText}`,
            );

            if (!azureResponse.ok) {
              return res.status(azureResponse.status).json({
                error: 'Azure OpenAI request failed',
                status: azureResponse.status,
                details: responseText,
              });
            }

            let data: any;
            try {
              data = JSON.parse(responseText);
            } catch (parseError) {
              logger.error(
                `[infra-assistant] JSON parse error: ${String(parseError)}`,
              );
              return res.status(500).json({
                error: 'Failed to parse Azure response as JSON',
                raw: responseText,
              });
            }

            const reply =
              data?.choices?.[0]?.message?.content?.trim() ||
              '응답을 받았지만 내용이 비어 있습니다.';

            return res.json({ reply });
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);

            logger.error(`[infra-assistant] unexpected error: ${errorMessage}`);

            return res.status(500).json({
              error: 'Unexpected server error',
              details: errorMessage,
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