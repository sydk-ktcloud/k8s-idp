import { createDevApp } from '@backstage/dev-utils';
import { infraAssistantPlugin, InfraAssistantPage } from '../src/plugin';

createDevApp()
  .registerPlugin(infraAssistantPlugin)
  .addPage({
    element: <InfraAssistantPage />,
    title: 'Root Page',
    path: '/infra-assistant',
  })
  .render();
