import App from './App';
import ReactDOM from 'react-dom/client';
import {ThemeProvider} from '@mui/material/styles';
import {theme} from './theme';
import './index.css';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <ThemeProvider theme={theme}>
    <App />
  </ThemeProvider>
);
