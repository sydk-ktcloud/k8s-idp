import { useState } from 'react';

import { COLORS } from '../../../styles/Colors';

interface CalendarModalProps {
  isOpen: boolean;
  onConfirm: (date: string) => void;
  onClose: () => void;
}

export default function CalendarModal({
  isOpen,
  onConfirm,
  onClose,
}: CalendarModalProps) {
  const [date, setDate] = useState('');
  const [error, setError] = useState('');
  const today = new Date().toISOString().split('T')[0];

  const handleConfirm = () => {
    onConfirm(date);
    setDate('');
  };

  const handleClose = () => {
    setDate('');
    onClose();
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setDate(value);
    if (value && value < today) {
      setError('해당 일자는 선택이 불가능합니다.');
    } else {
      setError('');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      data-testid='modal-overlay'
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'
      onClick={handleClose}
    >
      <div
        data-testid='modal-content'
        className='p-6 shadow-xl rounded-xl w-80'
        style={{ backgroundColor: COLORS.BG_PRIMARY }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className='mb-4 text-lg font-semibold'
          style={{ color: COLORS.TEXT_PRIMARY }}
        >
          출발일을 선택해주세요
        </h2>
        <input
          type='date'
          aria-label='출발일'
          value={date}
          min={today}
          onChange={handleDateChange}
          className='w-full px-3 py-2 mb-6 border rounded-lg'
          style={{
            backgroundColor: COLORS.DESCRIPTION_BG,
            borderColor: COLORS.INPUT_BOX,
            color: COLORS.TEXT_PRIMARY,
          }}
        />
        {error && (
          <p style={{ color: COLORS.REQUIRED }} className='mt-1 mb-4 text-xs'>
            {error}
          </p>
        )}
        <div className='flex gap-3'>
          <button
            type='button'
            onClick={handleClose}
            className='flex-1 py-2 text-sm border rounded-lg'
            style={{
              borderColor: COLORS.INFO_BOX,
              color: COLORS.TEXT_PRIMARY,
            }}
          >
            취소
          </button>
          <button
            type='button'
            onClick={handleConfirm}
            disabled={!date || date < today}
            className='flex-1 py-2 text-sm text-white rounded-lg disabled:opacity-40 disabled:cursor-not-allowed'
            style={{ backgroundColor: COLORS.BUTTON_MAIN }}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
