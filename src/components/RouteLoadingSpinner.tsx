import { FC, memo } from 'react';
import { Box, Spinner, Text, VStack } from '@chakra-ui/react';

const RouteLoadingSpinner: FC = memo(() => {
  return (
    <Box
      height="100vh"
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="gray.50"
      _dark={{ bg: 'gray.900' }}
    >
      <VStack spacing={4}>
        <Spinner thickness="4px" speed="0.65s" emptyColor="gray.200" color="blue.500" size="xl" />
        <Text fontSize="lg" color="gray.600" _dark={{ color: 'gray.400' }}>
          Loading...
        </Text>
      </VStack>
    </Box>
  );
});

RouteLoadingSpinner.displayName = 'RouteLoadingSpinner';

export default RouteLoadingSpinner;
