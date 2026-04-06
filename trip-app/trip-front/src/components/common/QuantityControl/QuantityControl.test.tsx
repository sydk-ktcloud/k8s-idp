import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import QuantityControl from './QuantityControl';

test('현재 수량이 렌더링된다', () => {
  render(<QuantityControl quantity={1} onChange={() => {}} />);
  expect(screen.getByText('1')).toBeInTheDocument();
});

test('+ 버튼 클릭 시 onChange가 증가된 값으로 호출된다', async () => {
  const handleChange = vi.fn();
  const user = userEvent.setup();
  render(<QuantityControl quantity={2} onChange={handleChange} />);

  await user.click(screen.getByRole('button', { name: '수량 증가' }));
  expect(handleChange).toHaveBeenCalledWith(3);
});

test('- 버튼 클릭 시 onChange가 감소된 값으로 호출된다', async () => {
  const handleChange = vi.fn();
  const user = userEvent.setup();
  render(<QuantityControl quantity={2} onChange={handleChange} />);

  await user.click(screen.getByRole('button', { name: '수량 감소' }));
  expect(handleChange).toHaveBeenCalledWith(1);
});

test('수량이 1일 때 - 버튼 클릭 시 onChange가 호출되지 않는다', async () => {
  const handleChange = vi.fn();
  const user = userEvent.setup();
  render(<QuantityControl quantity={1} onChange={handleChange} />);

  await user.click(screen.getByRole('button', { name: '수량 감소' }));
  expect(handleChange).not.toHaveBeenCalled();
});

test('수량이 1일 때 - 버튼이 비활성화된다', () => {
  render(<QuantityControl quantity={1} onChange={() => {}} />);
  expect(screen.getByRole('button', { name: '수량 감소' })).toBeDisabled();
});

test('min prop이 설정되면 해당 값에서 - 버튼이 비활성화된다', () => {
  render(<QuantityControl quantity={1} onChange={() => {}} min={1} />);
  expect(screen.getByRole('button', { name: '수량 감소' })).toBeDisabled();
});
