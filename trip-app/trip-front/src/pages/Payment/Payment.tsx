import { useLocation, useNavigate } from 'react-router-dom';

import BookerInfoForm from './components/BookerInfoForm';
import BookingItemsSection from './components/BookingItemsSection';
import PaymentCompletedView from './components/PaymentCompletedView';
import PaymentHeader from './components/PaymentHeader';
import PaymentSummary from './components/PaymentSummary';
import TermsAgreement from './components/TermsAgreement';
import { usePaymentForm } from './hooks/usePaymentForm';
import { usePaymentItems } from './hooks/usePaymentItems';
import { usePaymentSelection } from './hooks/usePaymentSelection';
import { useSubmitPayment } from './hooks/useSubmitPayment';
import { COLORS } from '../../styles/Colors';

export default function Payment() {
  const location = useLocation();
  const navigate = useNavigate();
  const { bookingItems, isPreviewFlow, isCartLoading, cartError } =
    usePaymentItems(location.state);
  const {
    effectiveSelectedItems,
    effectiveQuantities,
    selectedPaymentItems,
    selectedTotal,
    handleItemCheckChange,
    handleQuantityChange,
  } = usePaymentSelection(bookingItems);
  const { formData, termsAccepted, handleInputChange, handleTermsChange } =
    usePaymentForm();
  const {
    completedOrderNumber,
    submitError,
    isSubmitting,
    handleSubmitPayment,
  } = useSubmitPayment({
    bookingItems,
    effectiveSelectedItems,
    effectiveQuantities,
    formData,
    termsAccepted,
    selectedTotal,
  });
  const cartStatusMessage =
    !isPreviewFlow && isCartLoading
      ? '장바구니 불러오는 중...'
      : !isPreviewFlow && cartError
        ? '장바구니를 불러오지 못했습니다.'
        : !isPreviewFlow && bookingItems.length === 0
          ? '장바구니가 비어 있습니다.'
          : null;
  const cartStatusColor = cartError ? COLORS.NOTIFICATION : COLORS.TEXT_SUB;

  if (completedOrderNumber) {
    return (
      <PaymentCompletedView
        orderNumber={completedOrderNumber}
        onConfirm={() => navigate('/')}
      />
    );
  }

  return (
    <div
      className='min-h-screen w-full'
      style={{
        backgroundColor: COLORS.BG_PRIMARY,
        color: COLORS.TEXT_PRIMARY,
      }}
    >
      <div className='mx-auto flex w-full max-w-[1512px] flex-col items-center'>
        <PaymentHeader
          total={`₩ ${selectedTotal.toLocaleString('ko-KR')}`}
          onBack={() => navigate(-1)}
        />

        <div
          className='h-px w-full'
          style={{ backgroundColor: COLORS.INFO_BOX }}
        />

        <div className='flex w-full flex-col gap-10 overflow-y-auto px-6 py-8 md:px-[150px]'>
          <BookingItemsSection
            items={bookingItems}
            selectedItems={effectiveSelectedItems}
            quantities={effectiveQuantities}
            onToggleItem={handleItemCheckChange}
            onQuantityChange={handleQuantityChange}
          />
          {cartStatusMessage ? (
            <p className='text-sm' style={{ color: cartStatusColor }}>
              {cartStatusMessage}
            </p>
          ) : null}

          <div
            className='h-px w-full'
            style={{ backgroundColor: COLORS.INFO_BOX }}
          />

          <section className='grid grid-cols-1 gap-8 xl:grid-cols-[1fr_349px]'>
            <div className='flex flex-col gap-8'>
              <BookerInfoForm
                formData={formData}
                onInputChange={handleInputChange}
              />
              <TermsAgreement
                termsAccepted={termsAccepted}
                onTermsChange={handleTermsChange}
              />
            </div>

            <PaymentSummary
              items={selectedPaymentItems}
              total={`${selectedTotal.toLocaleString('ko-KR')} 원`}
              isSubmitting={isSubmitting}
              submitError={submitError}
              onSubmit={handleSubmitPayment}
            />
          </section>

          <div
            className='h-px w-full'
            style={{ backgroundColor: COLORS.INFO_BOX }}
          />

          <footer className='pb-8 text-base' style={{ color: COLORS.TEXT_SUB }}>
            Copyright @Groom-01
          </footer>
        </div>
      </div>
    </div>
  );
}
