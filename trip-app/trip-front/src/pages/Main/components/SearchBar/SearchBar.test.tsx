import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import SearchBar from './SearchBar';

test('검색어 입력창 렌더링', () => {
  render(<SearchBar value='' onSearch={() => {}} />);
  expect(
    screen.getByPlaceholderText('여행 상품을 검색하세요'),
  ).toBeInTheDocument();
});

test('검색어 입력 시 onSearch 호출', async () => {
  // 호출 여부 파악을 위한 mock function
  const handleSearch = vi.fn();
  const user = userEvent.setup();
  render(<SearchBar value='' onSearch={handleSearch} />);

  // 유저의 타이핑 이벤트 시뮬레이션 -> 실제 사용자와 같이 ㅈ, ㅔ, ㅈ, ㅜ... 이벤트를 순차적으로 발생
  await user.type(
    screen.getByPlaceholderText('여행 상품을 검색하세요'),
    '제주',
  );
  expect(handleSearch).toHaveBeenCalled();
});

test('value prop이 입력창에 표시된다', () => {
  render(<SearchBar value='제주' onSearch={() => {}} />);
  expect(screen.getByDisplayValue('제주')).toBeInTheDocument();
});
