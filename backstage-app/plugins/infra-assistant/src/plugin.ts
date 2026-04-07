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
      import('./components/InfraAssistantPage').then(m => m.InfraAssistantPage),
    mountPoint: rootRouteRef,
  }),
);