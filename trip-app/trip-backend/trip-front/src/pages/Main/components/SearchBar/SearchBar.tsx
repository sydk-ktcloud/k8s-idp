import { useState } from 'react';

import { COLORS } from '../../../../styles/Colors';

interface SearchBarProps {
  value: string;
  onSearch: (value: string) => void;
}

export default function SearchBar({ value, onSearch }: SearchBarProps) {
  const [focused, setFocused] = useState(false);

  return (
    <div className='relative w-full'>
      <svg
        className='absolute w-5 h-5 text-gray-400 -translate-y-1/2 left-3 top-1/2'
        fill='none'
        stroke='currentColor'
        viewBox='0 0 24 24'
        aria-hidden='true'
      >
        <path
          strokeLinecap='round'
          strokeLinejoin='round'
          strokeWidth={2}
          d='M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z'
        />
      </svg>
      <input
        type='text'
        placeholder='여행 상품을 검색하세요'
        value={value}
        onChange={(e) => onSearch(e.target.value)}
        className='w-full px-4 py-3 pl-10 border rounded-lg focus:outline-none'
        style={{
          backgroundColor: COLORS.SEARCH_BG,
          borderColor: focused ? COLORS.BUTTON_MAIN : COLORS.INPUT_BOX,
          color: COLORS.PLACEHOLDER,
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      />
    </div>
  );
}
