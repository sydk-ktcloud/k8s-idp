import type { SVGProps } from 'react';

export const ChevronLeft = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox='0 0 24 24' fill='none' aria-hidden='true' {...props}>
    <path
      d='M14.5 5.5L8 12l6.5 6.5'
      stroke='currentColor'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
  </svg>
);

export const CheckSmall = (props: SVGProps<SVGSVGElement>) => (
  <svg viewBox='0 0 24 24' fill='none' aria-hidden='true' {...props}>
    <path
      d='M6 12.5l4 4 8-9'
      stroke='white'
      strokeWidth='2'
      strokeLinecap='round'
      strokeLinejoin='round'
    />
  </svg>
);
