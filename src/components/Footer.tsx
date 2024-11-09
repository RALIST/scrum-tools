import { FC } from 'react'
import {
    Box,
    Container,
    Text,
    Link,
    HStack,
    useColorMode,
    Icon
} from '@chakra-ui/react'
import { FaGithub } from 'react-icons/fa'

const Footer: FC = () => {
    const { colorMode } = useColorMode()

    return (
        <Box
            as="footer"
            py={4}
            borderTop="1px"
            borderColor={colorMode === 'light' ? 'gray.200' : 'gray.700'}
            bg={colorMode === 'light' ? 'white' : 'gray.800'}
        >
            <Container maxW="container.xl">
                <HStack justify="space-between" align="center">
                    <Text fontSize="sm" color={colorMode === 'light' ? 'gray.600' : 'gray.400'}>
                        © {new Date().getFullYear()} Scrum Tools. All rights reserved.
                    </Text>
                    <Link
                        href="https://github.com/yourusername/scrum-tools"
                        isExternal
                        display="flex"
                        alignItems="center"
                        color={colorMode === 'light' ? 'gray.600' : 'gray.400'}
                        _hover={{ color: 'blue.500' }}
                    >
                        <Icon as={FaGithub} boxSize={5} />
                    </Link>
                </HStack>
            </Container>
        </Box>
    )
}

export default Footer
