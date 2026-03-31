import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import CalendarModal from './CalendarModal';

const TODAY = new Date().toISOString().split('T')[0];

const CalendarProps = {
  isOpen: true,
  onConfirm: vi.fn(),
  onClose: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
});

test('isOpen 이 true가 되면 모달이 렌더링 된다', () => {
  render(<CalendarModal {...CalendarProps} />);
  expect(screen.getByText('출발일을 선택해주세요')).toBeInTheDocument();
});

test('isOpen 이 false가 되면 모달 렌더링이 중단된다', () => {
  render(<CalendarModal {...CalendarProps} isOpen={false} />);
  expect(screen.queryByText('출발일을 선택해주세요')).not.toBeInTheDocument();
});

test('날짜 미선택 시 확인 버튼이 비활성화된다', () => {
  render(<CalendarModal {...CalendarProps} />);
  expect(screen.getByRole('button', { name: '확인' })).toBeDisabled();
});

test('날짜 선택 후 확인 버튼이 활성화된다', () => {
  render(<CalendarModal {...CalendarProps} />);
  fireEvent.change(screen.getByLabelText('출발일'), {
    target: { value: '2026-12-01' },
  });
  expect(screen.getByRole('button', { name: '확인' })).not.toBeDisabled();
});

test('날짜 선택 후 확인 클릭 시 onConfirm이 선택한 날짜와 함께 호출된다', async () => {
  const handleConfirm = vi.fn();
  const user = userEvent.setup();
  render(<CalendarModal {...CalendarProps} onConfirm={handleConfirm} />);

  fireEvent.change(screen.getByLabelText('출발일'), {
    target: { value: '2026-12-01' },
  });
  await user.click(screen.getByRole('button', { name: '확인' }));

  expect(handleConfirm).toHaveBeenCalledWith('2026-12-01');
});

test('취소 클릭 시 onClose가 호출된다', async () => {
  const handleClose = vi.fn();
  const user = userEvent.setup();
  render(<CalendarModal {...CalendarProps} onClose={handleClose} />);

  await user.click(screen.getByRole('button', { name: '취소' }));
  expect(handleClose).toHaveBeenCalled();
});

test('오버레이 클릭 시 onClose가 호출된다', async () => {
  const handleClose = vi.fn();
  const user = userEvent.setup();
  render(<CalendarModal {...CalendarProps} onClose={handleClose} />);

  await user.click(screen.getByTestId('modal-overlay'));
  expect(handleClose).toHaveBeenCalled();
});

test('모달 내부 클릭 시 onClose가 호출되지 않는다', async () => {
  const handleClose = vi.fn();
  const user = userEvent.setup();
  render(<CalendarModal {...CalendarProps} onClose={handleClose} />);

  await user.click(screen.getByTestId('modal-content'));
  expect(handleClose).not.toHaveBeenCalled();
});

test('과거 날짜를 선택할 수 없다', () => {
  render(<CalendarModal {...CalendarProps} />);
  expect(screen.getByLabelText('출발일')).toHaveAttribute('min', TODAY);
});

test('과거 날짜를 입력하면 확인 버튼이 비활성화 상태가 된다', () => {
  render(<CalendarModal {...CalendarProps} />);
  fireEvent.change(screen.getByLabelText('출발일'), {
    target: { value: '2020-01-01' },
  });
  expect(screen.getByRole('button', { name: '확인' })).toBeDisabled();
});

test('과거 날짜를 입력하면 에러 메시지가 표시된다', () => {
  render(<CalendarModal {...CalendarProps} />);
  fireEvent.change(screen.getByLabelText('출발일'), {
    target: { value: '2020-01-01' },
  });
  expect(
    screen.getByText('해당 일자는 선택이 불가능합니다.'),
  ).toBeInTheDocument();
});

test('유효한 날짜를 입력하면 에러 메시지가 표시되지 않는다', () => {
  render(<CalendarModal {...CalendarProps} />);
  fireEvent.change(screen.getByLabelText('출발일'), {
    target: { value: '2020-01-01' },
  });
  fireEvent.change(screen.getByLabelText('출발일'), {
    target: { value: '2026-12-01' },
  });
  expect(
    screen.queryByText('해당 일자는 선택이 불가능합니다.'),
  ).not.toBeInTheDocument();
});
