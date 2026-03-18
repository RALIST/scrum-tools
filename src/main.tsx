import { ChakraProvider, ColorModeScript, type ThemeConfig } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'; // Import React Query
import React from 'react'; // Import React
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import theme from './theme';
import { initFontOptimization } from './utils/fontOptimization';
import { initPerformanceTracking } from './utils/performance';

// Create a client
const queryClient = new QueryClient();

// Initialize performance tracking and font optimization
initPerformanceTracking();
initFontOptimization();

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- root element is guaranteed to exist in index.html
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Add StrictMode */}
    <QueryClientProvider client={queryClient}>
      {/* Add QueryClientProvider */}
      <ChakraProvider theme={theme}>
        <ColorModeScript initialColorMode={(theme['config'] as ThemeConfig).initialColorMode} />
        <App />
      </ChakraProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
