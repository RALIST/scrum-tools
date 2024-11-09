import { FC } from 'react'
import {
    Box,
    Container,
    HStack,
    Link,
    useColorMode,
    IconButton,
    Tooltip,
    Menu,
    MenuButton,
    MenuList,
    MenuItem,
    useBreakpointValue,
    Button
} from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'
import { MoonIcon, SunIcon, HamburgerIcon } from '@chakra-ui/icons'

const Navbar: FC = () => {
    const { colorMode, toggleColorMode } = useColorMode()
    const isMobile = useBreakpointValue({ base: true, md: false })

    const NavLinks = () => (
        <>
            <Link
                as={RouterLink}
                to="/"
                fontSize="lg"
                fontWeight="bold"
                _hover={{ textDecoration: 'none', color: 'blue.500' }}
            >
                Home
            </Link>
            <Link
                as={RouterLink}
                to="/retro"
                fontSize="lg"
                fontWeight="bold"
                _hover={{ textDecoration: 'none', color: 'blue.500' }}
            >
                Retro Board
            </Link>
            <Link
                as={RouterLink}
                to="/planning-poker"
                fontSize="lg"
                fontWeight="bold"
                _hover={{ textDecoration: 'none', color: 'blue.500' }}
            >
                Planning Poker
            </Link>
            <Link
                as={RouterLink}
                to="/daily-standup"
                fontSize="lg"
                fontWeight="bold"
                _hover={{ textDecoration: 'none', color: 'blue.500' }}
            >
                Daily Standup
            </Link>
            <Link
                as={RouterLink}
                to="/velocity"
                fontSize="lg"
                fontWeight="bold"
                _hover={{ textDecoration: 'none', color: 'blue.500' }}
            >
                Team Velocity
            </Link>
        </>
    )

    const ThemeToggle = () => (
        <Tooltip label={`Switch to ${colorMode === 'light' ? 'dark' : 'light'} mode`}>
            <IconButton
                aria-label={`Switch to ${colorMode === 'light' ? 'dark' : 'light'} mode`}
                icon={colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
                onClick={toggleColorMode}
                variant="ghost"
                colorScheme="blue"
            />
        </Tooltip>
    )

    return (
        <Box
            as="nav"
            py={4}
            borderBottom="1px"
            borderColor={colorMode === 'light' ? 'gray.200' : 'gray.700'}
            bg={colorMode === 'light' ? 'white' : 'gray.800'}
            position="sticky"
            top={0}
            zIndex="sticky"
        >
            <Container maxW="container.xl">
                {isMobile ? (
                    <HStack justify="space-between">
                        <Link
                            as={RouterLink}
                            to="/"
                            fontSize="lg"
                            fontWeight="bold"
                            _hover={{ textDecoration: 'none', color: 'blue.500' }}
                        >
                            Home
                        </Link>
                        <HStack>
                            <ThemeToggle />
                            <Menu>
                                <MenuButton
                                    as={Button}
                                    variant="ghost"
                                    rightIcon={<HamburgerIcon />}
                                />
                                <MenuList>
                                    <MenuItem as={RouterLink} to="/retro">
                                        Retro Board
                                    </MenuItem>
                                    <MenuItem as={RouterLink} to="/planning-poker">
                                        Planning Poker
                                    </MenuItem>
                                    <MenuItem as={RouterLink} to="/daily-standup">
                                        Daily Standup
                                    </MenuItem>
                                    <MenuItem as={RouterLink} to="/velocity">
                                        Team Velocity
                                    </MenuItem>
                                </MenuList>
                            </Menu>
                        </HStack>
                    </HStack>
                ) : (
                    <HStack spacing={8} justify="center">
                        <NavLinks />
                        <ThemeToggle />
                    </HStack>
                )}
            </Container>
        </Box>
    )
}

export default Navbar
