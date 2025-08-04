import React from 'react'; // Import React
import ReactDOM from 'react-dom/client';
import { ChakraProvider, ColorModeScript } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'; // Import React Query
import App from './App';
import theme from './theme';
import './index.css';

// Import performance tracking and PWA registration
import { initPerformanceTracking } from './utils/performance';
import { initFontOptimization } from './utils/fontOptimization';

// Create a client
const queryClient = new QueryClient();

// Initialize performance tracking and font optimization
initPerformanceTracking();
initFontOptimization();

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then(registration => {
        console.log('SW registered: ', registration);
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    {' '}
    {/* Add StrictMode */}
    <QueryClientProvider client={queryClient}>
      {' '}
      {/* Add QueryClientProvider */}
      <ChakraProvider theme={theme}>
        <ColorModeScript initialColorMode={theme.config.initialColorMode} />
        <App />
      </ChakraProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
