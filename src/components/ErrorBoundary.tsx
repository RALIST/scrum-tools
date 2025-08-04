import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  Box,
  Heading,
  Text,
  Button,
  VStack,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription,
  useColorMode,
} from '@chakra-ui/react';
import { createLogger } from '../utils/logger';

// Create logger for error boundary
const logger = createLogger('ErrorBoundary');

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error
    logger.error('Error caught by boundary:', {
      error: error.message,
      stack: error.stack,
      errorInfo,
    });

    // Update state with error info
    this.setState({
      error,
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // In production, you might want to send this to an error reporting service
    if (import.meta.env.PROD) {
      // Example: Send to error reporting service
      // errorReportingService.captureException(error, errorInfo);
    }
  }

  handleRetry = () => {
    // Reset error state to retry rendering
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    // Reload the entire page
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // If custom fallback is provided, use it
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <ErrorFallback
          error={this.state.error}
          onRetry={this.handleRetry}
          onReload={this.handleReload}
        />
      );
    }

    return this.props.children;
  }
}

// Functional component for the error fallback UI
interface ErrorFallbackProps {
  error: Error | null;
  onRetry: () => void;
  onReload: () => void;
}

const ErrorFallback: React.FC<ErrorFallbackProps> = ({ error, onRetry, onReload }) => {
  const { colorMode } = useColorMode();

  return (
    <Box
      minH="100vh"
      bg={colorMode === 'light' ? 'gray.50' : 'gray.900'}
      display="flex"
      alignItems="center"
      justifyContent="center"
      p={4}
    >
      <Box
        maxW="md"
        w="full"
        bg={colorMode === 'light' ? 'white' : 'gray.800'}
        borderRadius="lg"
        p={8}
        shadow="lg"
      >
        <VStack spacing={6} textAlign="center">
          <Alert status="error" borderRadius="md">
            <AlertIcon />
            <Box>
              <AlertTitle>Something went wrong!</AlertTitle>
              <AlertDescription>
                An unexpected error occurred. Please try refreshing the page or contact support if
                the problem persists.
              </AlertDescription>
            </Box>
          </Alert>

          <VStack spacing={4} w="full">
            <Heading size="md" color={colorMode === 'light' ? 'gray.700' : 'gray.300'}>
              Error Details
            </Heading>

            {error && (
              <Box
                w="full"
                p={4}
                bg={colorMode === 'light' ? 'gray.100' : 'gray.700'}
                borderRadius="md"
                fontSize="sm"
                fontFamily="mono"
                textAlign="left"
                maxH="200px"
                overflowY="auto"
              >
                <Text fontWeight="bold" mb={2}>
                  Error Message:
                </Text>
                <Text mb={4}>{error.message}</Text>

                {error.stack && import.meta.env.DEV && (
                  <>
                    <Text fontWeight="bold" mb={2}>
                      Stack Trace:
                    </Text>
                    <Text whiteSpace="pre-wrap" fontSize="xs">
                      {error.stack}
                    </Text>
                  </>
                )}
              </Box>
            )}

            <VStack spacing={3} w="full">
              <Button colorScheme="blue" size="lg" onClick={onRetry} w="full">
                Try Again
              </Button>

              <Button variant="outline" size="md" onClick={onReload} w="full">
                Reload Page
              </Button>

              <Text fontSize="sm" color="gray.500">
                If this error continues, please{' '}
                <Button
                  as="a"
                  href="mailto:dev@scrumtools.app"
                  variant="link"
                  fontSize="sm"
                  colorScheme="blue"
                >
                  contact support
                </Button>
              </Text>
            </VStack>
          </VStack>
        </VStack>
      </Box>
    </Box>
  );
};

export default ErrorBoundary;

// Higher-order component for wrapping components with error boundary
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode,
  onError?: (error: Error, errorInfo: ErrorInfo) => void
) => {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary fallback={fallback} onError={onError}>
      <Component {...props} />
    </ErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;

  return WrappedComponent;
};

// Hook for error boundary functionality in functional components
export const useErrorHandler = () => {
  return (error: Error, errorInfo?: ErrorInfo) => {
    logger.error('Manual error reported:', { error: error.message, stack: error.stack, errorInfo });

    // You could trigger a re-render or show a toast notification here
    throw error; // Re-throw to trigger error boundary
  };
};
