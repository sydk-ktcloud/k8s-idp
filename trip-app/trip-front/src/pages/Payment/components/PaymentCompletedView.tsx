import { COLORS } from '../../../styles/Colors';

type PaymentCompletedViewProps = {
  orderNumber: string;
  onConfirm: () => void;
};

export default function PaymentCompletedView({
  orderNumber,
  onConfirm,
}: PaymentCompletedViewProps) {
  return (
    <div
      className='flex min-h-screen w-full items-center justify-center px-6'
      style={{
        backgroundColor: COLORS.BG_PRIMARY,
        color: COLORS.TEXT_PRIMARY,
      }}
    >
      <div className='flex flex-col items-center gap-6 text-center'>
        <h1 className='text-2xl font-bold'>결제가 완료되었습니다</h1>
        <p className='text-lg'>주문번호 : {orderNumber}</p>
        <button
          type='button'
          className='h-12 rounded-xl px-10 text-base font-semibold text-white'
          style={{ backgroundColor: COLORS.BUTTON_MAIN }}
          onClick={onConfirm}
        >
          확인
        </button>
      </div>
    </div>
  );
}
