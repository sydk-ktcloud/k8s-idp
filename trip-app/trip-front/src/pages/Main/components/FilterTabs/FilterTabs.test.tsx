import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import FilterTabs from './FilterTabs';

const CATEGORIES = [
  '전체',
  '자연관광',
  '역사탐방',
  '음식여행',
  '도시여행',
  '문화예술',
];

test('모든 필터 탭이 렌더링된다', () => {
  render(<FilterTabs selected='전체' onSelect={() => {}} />);
  CATEGORIES.forEach((cat) => {
    expect(screen.getByText(cat)).toBeInTheDocument();
  });
});

test('탭 클릭 시 onSelect가 호출된다', async () => {
  const handleSelect = vi.fn();
  const user = userEvent.setup();
  render(<FilterTabs selected='전체' onSelect={handleSelect} />);

  await user.click(screen.getByText('자연관광'));
  expect(handleSelect).toHaveBeenCalledWith('자연관광');
});

test('선택된 탭에 활성 스타일이 적용된다', () => {
  render(<FilterTabs selected='자연관광' onSelect={() => {}} />);
  expect(screen.getByText('자연관광').className).toContain(
    'text-[var(--category-selected-text)]',
  );
  expect(screen.getByText('전체').className).not.toContain(
    'text-[var(--category-selected-text)]',
  );
});
