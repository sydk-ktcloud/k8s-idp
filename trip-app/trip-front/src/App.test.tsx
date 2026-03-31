import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import App from './App';

const queryClient = new QueryClient();

test('렌더링 확인', () => {
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  expect(screen.getByText('GoormTrip')).toBeInTheDocument();
});
