import {
  createBackendModule,
  coreServices,
} from '@backstage/backend-plugin-api';
import { scaffolderActionsExtensionPoint } from '@backstage/plugin-scaffolder-node/alpha';
import { createTemplateAction } from '@backstage/plugin-scaffolder-node';
import * as k8s from '@kubernetes/client-node';
import yaml from 'yaml';

function createKubernetesApplyAction() {
  return createTemplateAction<{
    manifest: string;
    clusterName?: string;
  }>({
    id: 'kubernetes:apply',
    description: 'Kubernetes 매니페스트를 클러스터에 적용합니다',
    schema: {
      input: {
        type: 'object',
        required: ['manifest'],
        properties: {
          manifest: {
            type: 'string',
            title: 'Manifest',
            description: 'YAML manifest to apply',
          },
          clusterName: {
            type: 'string',
            title: 'Cluster Name',
            description: 'Target cluster name (ignored, uses in-cluster)',
          },
        },
      },
    },
    async handler(ctx) {
      const { manifest } = ctx.input;

      const kc = new k8s.KubeConfig();
      kc.loadFromCluster();

      const client = k8s.KubernetesObjectApi.makeApiClient(kc);

      const docs = yaml.parseAllDocuments(manifest);
      for (const doc of docs) {
        const spec = doc.toJSON();
        if (!spec || !spec.kind) continue;

        spec.metadata = spec.metadata || {};
        spec.metadata.annotations = spec.metadata.annotations || {};
        spec.metadata.annotations['backstage.io/managed-by'] = 'scaffolder';

        try {
          await client.read(spec);
          await client.patch(spec, undefined, undefined, 'backstage-scaffolder', true);
          ctx.logger.info(
            `Patched ${spec.kind}/${spec.metadata.name} in ${spec.metadata.namespace || 'default'}`,
          );
        } catch (e: any) {
          if (e?.statusCode === 404 || e?.response?.statusCode === 404) {
            await client.create(spec);
            ctx.logger.info(
              `Created ${spec.kind}/${spec.metadata.name} in ${spec.metadata.namespace || 'default'}`,
            );
          } else {
            throw e;
          }
        }
      }
    },
  });
}

export default createBackendModule({
  pluginId: 'scaffolder',
  moduleId: 'kubernetes-apply',
  register(reg) {
    reg.registerInit({
      deps: {
        scaffolder: scaffolderActionsExtensionPoint,
        logger: coreServices.logger,
      },
      async init({ scaffolder, logger }) {
        scaffolder.addActions(createKubernetesApplyAction());
        logger.info('kubernetes:apply scaffolder action registered');
      },
    });
  },
});
