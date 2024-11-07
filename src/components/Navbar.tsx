import { FC } from 'react'
import { Box, Flex, Link, Button, useColorMode } from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'

const Navbar: FC = () => {
    const { colorMode, toggleColorMode } = useColorMode()

    return (
        <Box as="nav" bg={colorMode === 'light' ? 'white' : 'gray.800'} px={4} py={3} shadow="md">
            <Flex maxW="1200px" mx="auto" align="center" justify="space-between">
                <Flex align="center" gap={8}>
                    <Link as={RouterLink} to="/" fontSize="xl" fontWeight="bold" _hover={{ textDecoration: 'none' }}>
                        Scrum Tools
                    </Link>
                    <Flex gap={4}>
                        <Link as={RouterLink} to="/planning-poker" _hover={{ textDecoration: 'none' }}>
                            Planning Poker
                        </Link>
                        <Link as={RouterLink} to="/daily-standup" _hover={{ textDecoration: 'none' }}>
                            Daily Standup
                        </Link>
                    </Flex>
                </Flex>
                <Button onClick={toggleColorMode}>
                    {colorMode === 'light' ? 'Dark' : 'Light'} Mode
                </Button>
            </Flex>
        </Box>
    )
}

export default Navbar
