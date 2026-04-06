import { COLORS } from '../../../styles/Colors';
import type {
  PaymentFormData,
  PaymentInputChange,
} from '../../../types/payment';

interface BookerInfoFormProps {
  formData: PaymentFormData;
  onInputChange: PaymentInputChange;
}

export default function BookerInfoForm({
  formData,
  onInputChange,
}: BookerInfoFormProps) {
  return (
    <form
      className='p-6 border rounded-xl'
      style={{ borderColor: COLORS.INFO_BOX }}
    >
      <h3 className='mb-6 text-xl font-semibold'>예약자 정보</h3>
      <div className='grid gap-5 md:grid-cols-[90px_1fr] md:items-center'>
        <label
          htmlFor='lastName'
          className='text-base'
          style={{ color: COLORS.TEXT_PRIMARY }}
        >
          성 <span style={{ color: COLORS.REQUIRED }}>*</span>
        </label>
        <input
          id='lastName'
          name='lastName'
          value={formData.lastName}
          onChange={onInputChange}
          placeholder='성을 입력해주세요.'
          className='h-12 px-4 text-base border rounded-xl'
          style={{
            borderColor: COLORS.INPUT_BOX,
            color: COLORS.TEXT_PRIMARY,
            backgroundColor: 'transparent',
          }}
        />

        <label
          htmlFor='firstName'
          className='text-base'
          style={{ color: COLORS.TEXT_PRIMARY }}
        >
          이름 <span style={{ color: COLORS.REQUIRED }}>*</span>
        </label>
        <input
          id='firstName'
          name='firstName'
          value={formData.firstName}
          onChange={onInputChange}
          placeholder='이름을 입력해주세요.'
          className='h-12 px-4 text-base border rounded-xl'
          style={{
            borderColor: COLORS.INPUT_BOX,
            color: COLORS.TEXT_PRIMARY,
            backgroundColor: 'transparent',
          }}
        />

        <label
          htmlFor='phone'
          className='text-base'
          style={{ color: COLORS.TEXT_PRIMARY }}
        >
          전화번호 <span style={{ color: COLORS.REQUIRED }}>*</span>
        </label>
        <div
          className='flex items-center h-12 gap-2 px-4 border rounded-xl'
          style={{ borderColor: COLORS.INPUT_BOX }}
        >
          <span className='text-base' style={{ color: COLORS.TEXT_SUB }}>
            +82
          </span>
          <input
            id='phone'
            name='phone'
            value={formData.phone}
            onChange={onInputChange}
            inputMode='numeric'
            pattern='[0-9]*'
            autoComplete='tel-national'
            placeholder='전화번호를 입력해주세요.'
            className='w-full text-base'
            style={{
              color: COLORS.TEXT_PRIMARY,
              backgroundColor: 'transparent',
            }}
          />
        </div>

        <label
          htmlFor='email'
          className='text-base'
          style={{ color: COLORS.TEXT_PRIMARY }}
        >
          이메일 <span style={{ color: COLORS.REQUIRED }}>*</span>
        </label>
        <input
          id='email'
          name='email'
          type='email'
          value={formData.email}
          onChange={onInputChange}
          placeholder='groom@example.com'
          className='h-12 px-4 text-base border rounded-xl'
          style={{
            borderColor: COLORS.INPUT_BOX,
            color: COLORS.TEXT_PRIMARY,
            backgroundColor: 'transparent',
          }}
        />
      </div>
    </form>
  );
}
