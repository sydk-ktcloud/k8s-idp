import { IoClose } from 'react-icons/io5';

import { COLORS } from '../../../styles/Colors';

interface ProductHeaderProps {
  onClose: () => void;
}

export default function ProductHeader({ onClose }: ProductHeaderProps) {
  return (
    <div
      className='flex items-center justify-between w-full px-10 py-4 border-b-[1px] font-medium'
      style={{ borderColor: COLORS.SEARCH_BG }}
    >
      <div className='flex text-[16px]'>상품 구매하기</div>
      <button
        onClick={onClose}
        className='flex text-[24px] p-1 hover:bg-gray-100 rounded-full transition-colors cursor-pointer'
        aria-label='닫기'
      >
        <IoClose />
      </button>
    </div>
  );
}
