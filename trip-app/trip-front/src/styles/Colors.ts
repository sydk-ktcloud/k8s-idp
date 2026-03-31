/**
 * 다크 / 라이트 모드 자동으로 적용되도록 시스템 구성
 * import { COLORS }로 임포트 후 style 속성에 COLORS.BG_PRIMARY 형식으로 사용
 */

// CSS 변수 자동 생성 및 적용
const createColorSystem = () => {
  const lightColors = {
    'bg-primary': '#FFFFFF',
    'text-primary': '#262626',
    'text-sub': '#888888',
    'search-bg': '#E1E1E1',
    placeholder: '#999999',
    'category-selected-bg': '#C6E6FF',
    'category-selected-text': '#0043B3',
    'category-bg': '#F2F2F2',
    'category-text': '#4C4C4C',
    'button-main': '#2A72E5',
    'quantity-text': '#808080',
    cart: '#0043B3',
    notification: '#E74C3C',
    required: '#FF7575',
    checkbox: '#008CF5',
    'description-bg': '#F7F7F7',
    'info-box': '#E5E5E5',
    'input-box': '#D9D9D9',
  };

  const darkColors = {
    'bg-primary': '#232323',
    'text-primary': '#FAFAFA',
    'text-sub': '#888888',
    'search-bg': '#474747',
    placeholder: '#FAFAFA',
    'category-selected-bg': '#001286',
    'category-selected-text': '#7BC6FF',
    'category-bg': '#474747',
    'category-text': '#BEBEBE',
    'button-main': '#368AED',
    'quantity-text': '#808080',
    cart: '#0043B3',
    notification: '#E74C3C',
    required: '#E74C3C',
    checkbox: '#008CF5',
    'description-bg': '#282828',
    'info-box': '#E5E5E5',
    'input-box': '#D9D9D9',
  };

  // CSS 변수 자동 생성
  const createCSSVariables = () => {
    let css = ':root {\n  /* 라이트 모드 */\n';
    Object.entries(lightColors).forEach(([key, value]) => {
      css += `  --${key}: ${value};\n`;
    });
    css +=
      '}\n\n@media (prefers-color-scheme: dark) {\n  :root {\n    /* 다크 모드 - 시스템 환경에 맞게 자동 적용 */\n';
    Object.entries(darkColors).forEach(([key, value]) => {
      css += `    --${key}: ${value};\n`;
    });
    css += '  }\n}';
    return css;
  };

  // 스타일 태그로 CSS 주입
  if (typeof document !== 'undefined') {
    const existingStyle = document.getElementById('color-system');
    if (existingStyle) {
      existingStyle.remove();
    }

    const style = document.createElement('style');
    style.id = 'color-system';
    style.textContent = createCSSVariables();
    document.head.appendChild(style);
  }
};

// 초기화
createColorSystem();

// 사용할 색상 상수
export const COLORS = {
  BG_PRIMARY: 'var(--bg-primary)', // 기본 배경 색
  TEXT_PRIMARY: 'var(--text-primary)', // 텍스트 색상
  TEXT_SUB: 'var(--text-sub)', // 서브 텍스트 색
  SEARCH_BG: 'var(--search-bg)', // 검색 바
  PLACEHOLDER: 'var(--placeholder)', // placeholder
  CATEGORY_SELECTED_BG: 'var(--category-selected-bg)', // 카테고리 선택 배경
  CATEGORY_SELECTED_TEXT: 'var(--category-selected-text)', // 카테고리 선택 텍스트
  CATEGORY_BG: 'var(--category-bg)', // 카테고리 배경
  CATEGORY_TEXT: 'var(--category-text)', // 카테고리 텍스트
  BUTTON_MAIN: 'var(--button-main)', // 메인버튼 색
  QUANTITY_TEXT: 'var(--quantity-text)', // 수량 선택 텍스트
  CART: 'var(--cart)', // 장바구니
  NOTIFICATION: 'var(--notification)', // 장바구니 알림 색
  REQUIRED: 'var(--required)', // 필수 색
  CHECKBOX: 'var(--checkbox)', // 체크 박스 색
  DESCRIPTION_BG: 'var(--description-bg)', // Description 배경
  INFO_BOX: 'var(--info-box)', // info 박스 색
  INPUT_BOX: 'var(--input-box)', // input 박스 색
} as const;
