import { COLORS } from '../../../styles/Colors';
import type { TermsAccepted, TermsChangeHandler } from '../../../types/payment';

interface TermsAgreementProps {
  termsAccepted: TermsAccepted;
  onTermsChange: TermsChangeHandler;
}

export default function TermsAgreement({
  termsAccepted,
  onTermsChange,
}: TermsAgreementProps) {
  return (
    <div
      className='rounded-xl p-6'
      style={{ backgroundColor: COLORS.DESCRIPTION_BG }}
    >
      <h3 className='mb-4 text-xl font-semibold'>이용약관</h3>
      <div className='space-y-3 text-[15px]' style={{ color: COLORS.TEXT_SUB }}>
        <label className='flex cursor-pointer items-center gap-2'>
          <input
            type='checkbox'
            checked={termsAccepted.cancellation}
            onChange={() => onTermsChange('cancellation')}
          />
          취소규정 동의(필수)
        </label>
        <label className='flex cursor-pointer items-center gap-2'>
          <input
            type='checkbox'
            checked={termsAccepted.refund}
            onChange={() => onTermsChange('refund')}
          />
          취소 및 환불 정책 동의(필수)
        </label>
        <div
          className='h-px w-full'
          style={{ backgroundColor: COLORS.INFO_BOX }}
        />
        <label className='flex cursor-pointer items-center gap-2 text-base font-bold'>
          <input
            type='checkbox'
            checked={termsAccepted.all}
            onChange={() => onTermsChange('all')}
          />
          전체 동의
        </label>
      </div>
    </div>
  );
}
