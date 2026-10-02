import type { ViewStyle } from 'react-native';

/** Layout contract for portfolio editor sheet at 360dp / 200% font (scroll body + fixed footer). */
export const PORTFOLIO_EDITOR_TEST_IDS = {
  modal: 'portfolio-editor-modal',
  urlInput: 'portfolio-url-input',
  save: 'portfolio-save',
  cancel: 'portfolio-cancel',
  statusPrefix: 'portfolio-status-',
} as const;

export const portfolioEditorSheetLayout = {
  /** Caps sheet height so footer stays on-screen; body scrolls inside. */
  maxSheetHeightRatio: 0.94,
  keyboardAvoiding: true,
  footerOutsideScroll: true,
} as const;

export const portfolioEditorLayoutStyles: Record<'modalCard' | 'modalColumn' | 'modalScroll' | 'modalFooter', ViewStyle> = {
  modalCard: {
    maxHeight: `${portfolioEditorSheetLayout.maxSheetHeightRatio * 100}%`,
    width: '100%',
    flexDirection: 'column',
    flexShrink: 1,
    overflow: 'hidden',
  },
  modalColumn: {
    flexShrink: 1,
    minHeight: 0,
    maxHeight: '100%',
    flexDirection: 'column',
  },
  modalScroll: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  modalFooter: {
    flexShrink: 0,
  },
};
