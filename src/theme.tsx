import {PaletteMode} from '@mui/material';

declare module '@mui/material/styles' {
  interface TypeBackground {
    l0: string;
    l1: string;
    l2: string;
  }

  interface SimpleTypeBackgroundOptions {
    l0?: string;
    l1?: string;
    l2?: string;
  }
}

const getDesignTokens = (mode: PaletteMode) => ({
  palette: {
    mode,
    ...(mode === 'light'
      ? {
          // palette values for light mode
          primary: {
            main: '#9478f0',
          },
          background: {
            l0: '#f6f6f6',
            l1: '#ffffff',
            l2: '#f6f6f6',
            paper: '#ffffff',
            default: '#ffffff',
          },
        }
      : {
          // palette values for dark mode
          primary: {
            main: '#9478f0',
          },
          background: {
            l0: '#1a1a1a',
            l1: '#262626',
            l2: '#363636',
            paper: '#1e1e1e',
            default: '#1e1e1e',
          },
          text: {
            primary: '#dadada',
            secondary: '#a4a4a4',
          },
        }),
  },
});

type DesignTokens = ReturnType<typeof getDesignTokens>;

type DesignTheme = Omit<DesignTokens, 'palette'> & {
  palette: DesignTokens['palette'] & {
    mode: PaletteMode;
  };
};

export default getDesignTokens;
export type {DesignTokens, DesignTheme};
