export type FilterCategory =
  | '전체'
  | '자연관광'
  | '역사탐방'
  | '음식여행'
  | '도시여행'
  | '문화예술';

const FILTER_CATEGORIES: FilterCategory[] = [
  '전체',
  '자연관광',
  '역사탐방',
  '음식여행',
  '도시여행',
  '문화예술',
];

interface FilterTabsProps {
  selected: FilterCategory;
  onSelect: (category: FilterCategory) => void;
}

export default function FilterTabs({ selected, onSelect }: FilterTabsProps) {
  return (
    <div className='flex gap-2 py-2 overflow-x-auto'>
      {FILTER_CATEGORIES.map((cat) => (
        <button
          key={cat}
          onClick={() => onSelect(cat)}
          className={`px-4 py-2 rounded-full border text-sm whitespace-nowrap transition-colors cursor-pointer ${
            selected === cat
              ? 'border-[var(--category-selected-text)] bg-[var(--category-selected-bg)] text-[var(--category-selected-text)]'
              : 'border-gray-300 hover:bg-[var(--category-bg)] text-[var(--category-text)]'
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}
