import { COLORS } from '../../../styles/Colors';
import type { PaymentItem } from '../../../types/payment';

interface BookingItemsSectionProps {
  items: PaymentItem[];
  selectedItems: Record<number, boolean>;
  quantities: Record<number, number>;
  onToggleItem: (itemId: number) => void;
  onQuantityChange: (itemId: number, delta: number) => void;
}

export default function BookingItemsSection({
  items,
  selectedItems,
  quantities,
  onToggleItem,
  onQuantityChange,
}: BookingItemsSectionProps) {
  const selectedCount = items.filter((item) => selectedItems[item.id]).length;

  return (
    <section className='flex flex-col gap-6'>
      <h2 className='text-base' style={{ color: COLORS.TEXT_SUB }}>
        총 {selectedCount}개
      </h2>
      <div className='flex gap-6 overflow-x-auto pb-2'>
        {items.map((item) => (
          <article
            key={item.id}
            className='relative w-[360px] shrink-0 rounded-xl border p-4 shadow-sm'
            style={{
              backgroundColor: COLORS.BG_PRIMARY,
              borderColor: COLORS.INFO_BOX,
            }}
          >
            <div
              className='absolute right-4 top-4 z-10 h-[18px] w-[18px] rounded-sm border'
              style={{
                backgroundColor: selectedItems[item.id]
                  ? COLORS.CHECKBOX
                  : COLORS.BG_PRIMARY,
                borderColor: selectedItems[item.id]
                  ? COLORS.CHECKBOX
                  : COLORS.INFO_BOX,
              }}
            >
              <input
                type='checkbox'
                checked={selectedItems[item.id] ?? false}
                onChange={() => onToggleItem(item.id)}
                className='absolute -left-[3px] -top-[3px] h-6 w-6'
              />
            </div>

            <div className='flex gap-4'>
              <div
                className='h-[120px] w-[120px] shrink-0 overflow-hidden rounded-lg'
                style={{ backgroundColor: COLORS.DESCRIPTION_BG }}
              >
                <img
                  src={item.image}
                  alt={item.title}
                  className='h-full w-full object-cover'
                />
              </div>
              <div className='flex min-w-0 flex-1 flex-col justify-between'>
                <div className='flex items-start gap-3 pr-7'>
                  <div>
                    <h3 className='break-words whitespace-normal text-[15px] font-bold leading-[1.35]'>
                      {item.title}
                    </h3>
                    <time
                      className='text-xs'
                      style={{ color: COLORS.TEXT_SUB }}
                    >
                      {formatDateForDisplay(item.departureDate)}
                    </time>
                  </div>
                </div>

                <div className='flex items-center justify-between'>
                  <div
                    className='text-base font-bold'
                    style={{ color: COLORS.BUTTON_MAIN }}
                  >
                    {formatPrice(item.unitPrice)}
                  </div>
                  <div className='flex items-center'>
                    <button
                      type='button'
                      onClick={() => onQuantityChange(item.id, -1)}
                      className='h-5 w-5 rounded-sm text-sm font-bold transition-opacity hover:opacity-70'
                      style={{ color: COLORS.QUANTITY_TEXT }}
                      aria-label='수량 감소'
                    >
                      -
                    </button>
                    <span
                      className='min-w-7 text-center text-xs'
                      style={{ color: COLORS.QUANTITY_TEXT }}
                    >
                      {quantities[item.id] ?? item.quantity}
                    </span>
                    <button
                      type='button'
                      onClick={() => onQuantityChange(item.id, 1)}
                      className='h-5 w-5 rounded-sm text-sm font-bold transition-opacity hover:opacity-70'
                      style={{ color: COLORS.QUANTITY_TEXT }}
                      aria-label='수량 증가'
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function formatDateForDisplay(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}.${mm}.${dd}`;
}

function formatPrice(price: number): string {
  return `₩ ${price.toLocaleString('ko-KR')}`;
}
