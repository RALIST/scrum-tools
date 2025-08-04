import { FC, useEffect } from 'react';
import { Box, Button, VStack, Heading, useToast } from '@chakra-ui/react';
import { createLogger, LogLevel } from '../utils/logger';

// Create a component-specific logger
const logger = createLogger('DeveloperTools');

interface DeveloperToolsProps {
  isVisible?: boolean;
}

const DeveloperTools: FC<DeveloperToolsProps> = ({ isVisible = false }) => {
  const toast = useToast();

  useEffect(() => {
    if (import.meta.env.DEV) {
      logger.info('Developer tools component mounted');
    }
  }, []);

  const testLogLevels = () => {
    logger.error('Test error message', { component: 'DeveloperTools', action: 'testLogs' });
    logger.warn('Test warning message', { timestamp: new Date().toISOString() });
    logger.info('Test info message', { userAgent: navigator.userAgent });
    logger.debug('Test debug message', { location: window.location.href });
    logger.trace('Test trace message', { memory: (performance as any).memory });

    toast({
      title: 'Log Test Complete',
      description: 'Check the browser console for log messages',
      status: 'info',
      duration: 3000,
    });
  };

  const changeLogLevel = (level: LogLevel) => {
    logger.setLogLevel(level);
    logger.info(`Log level changed to: ${LogLevel[level]}`);

    toast({
      title: 'Log Level Changed',
      description: `New level: ${LogLevel[level]}`,
      status: 'success',
      duration: 2000,
    });
  };

  const toggleConsole = () => {
    const isEnabled = logger['config']?.enableConsole ?? true; // Access private property for demo
    logger.setConsoleEnabled(!isEnabled);

    toast({
      title: `Console Logging ${!isEnabled ? 'Enabled' : 'Disabled'}`,
      status: 'info',
      duration: 2000,
    });
  };

  // Only show in development mode
  if (!import.meta.env.DEV || !isVisible) {
    return null;
  }

  return (
    <Box
      position="fixed"
      bottom={4}
      right={4}
      bg="gray.800"
      color="white"
      p={4}
      borderRadius="md"
      shadow="lg"
      zIndex={9999}
      minW="250px"
    >
      <VStack spacing={3} align="stretch">
        <Heading size="sm">🛠️ Dev Tools</Heading>

        <Button size="xs" colorScheme="blue" onClick={testLogLevels}>
          Test All Log Levels
        </Button>

        <VStack spacing={2} align="stretch">
          <Button size="xs" variant="outline" onClick={() => changeLogLevel(LogLevel.ERROR)}>
            Error Level
          </Button>
          <Button size="xs" variant="outline" onClick={() => changeLogLevel(LogLevel.WARN)}>
            Warn Level
          </Button>
          <Button size="xs" variant="outline" onClick={() => changeLogLevel(LogLevel.INFO)}>
            Info Level
          </Button>
          <Button size="xs" variant="outline" onClick={() => changeLogLevel(LogLevel.DEBUG)}>
            Debug Level
          </Button>
          <Button size="xs" variant="outline" onClick={() => changeLogLevel(LogLevel.TRACE)}>
            Trace Level
          </Button>
        </VStack>

        <Button size="xs" colorScheme="red" variant="outline" onClick={toggleConsole}>
          Toggle Console
        </Button>
      </VStack>
    </Box>
  );
};

export default DeveloperTools;
