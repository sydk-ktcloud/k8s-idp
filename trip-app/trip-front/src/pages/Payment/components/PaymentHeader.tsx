import { ChevronLeft } from '../icons';

interface PaymentHeaderProps {
  total: string;
  onBack: () => void;
}

export default function PaymentHeader({ total, onBack }: PaymentHeaderProps) {
  return (
    <header className='flex w-full items-end justify-between px-6 pb-6 pt-10 md:px-[150px] md:pb-[30px] md:pt-[100px]'>
      <button
        type='button'
        onClick={onBack}
        className='inline-flex items-center gap-3'
        aria-label='이전 페이지로 이동'
      >
        <ChevronLeft className='h-10 w-10 md:h-[50px] md:w-[50px]' />
        <span className='w-fit text-2xl font-bold md:text-[28px]'>결제</span>
      </button>

      <div className='w-fit text-right text-2xl font-bold md:text-[28px]'>
        {total}
      </div>
    </header>
  );
}
