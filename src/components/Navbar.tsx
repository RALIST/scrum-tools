import { FC } from 'react'
import { Link as RouterLink, useLocation } from 'react-router-dom'
import {
    Box,
    Flex,
    HStack,
    Link,
    IconButton,
    useDisclosure,
    useColorModeValue,
    Stack,
    useColorMode,
    Button
} from '@chakra-ui/react'
import { HamburgerIcon, CloseIcon, MoonIcon, SunIcon } from '@chakra-ui/icons'

interface NavLinkProps {
    to: string
    children: React.ReactNode
    isActive: boolean
}

const NavLink: FC<NavLinkProps> = ({ to, children, isActive }) => (
    <Link
        as={RouterLink}
        px={2}
        py={1}
        rounded={'md'}
        _hover={{
            textDecoration: 'none',
            bg: useColorModeValue('gray.200', 'gray.700'),
        }}
        bg={isActive ? useColorModeValue('gray.200', 'gray.700') : 'transparent'}
        to={to}>
        {children}
    </Link>
)

const Navbar: FC = () => {
    const { isOpen, onOpen, onClose } = useDisclosure()
    const { colorMode, toggleColorMode } = useColorMode()
    const location = useLocation()

    const Links = [
        { name: 'Planning Poker', to: '/planning-poker' },
        { name: 'Daily Standup', to: '/daily-standup' },
        { name: 'Retro Board', to: '/retro' }
    ]

    return (
        <Box bg={useColorModeValue('white', 'gray.800')} px={4} shadow="sm">
            <Flex h={16} alignItems={'center'} justifyContent={'space-between'}>
                <IconButton
                    size={'md'}
                    icon={isOpen ? <CloseIcon /> : <HamburgerIcon />}
                    aria-label={'Open Menu'}
                    display={{ md: 'none' }}
                    onClick={isOpen ? onClose : onOpen}
                />
                <HStack spacing={8} alignItems={'center'}>
                    <Link
                        as={RouterLink}
                        to="/"
                        fontWeight="bold"
                        fontSize="lg"
                        _hover={{ textDecoration: 'none' }}
                    >
                        Scrum Tools
                    </Link>
                    <HStack
                        as={'nav'}
                        spacing={4}
                        display={{ base: 'none', md: 'flex' }}>
                        {Links.map((link) => (
                            <NavLink
                                key={link.to}
                                to={link.to}
                                isActive={location.pathname.startsWith(link.to)}
                            >
                                {link.name}
                            </NavLink>
                        ))}
                    </HStack>
                </HStack>
                <Button onClick={toggleColorMode}>
                    {colorMode === 'light' ? <MoonIcon /> : <SunIcon />}
                </Button>
            </Flex>

            {isOpen ? (
                <Box pb={4} display={{ md: 'none' }}>
                    <Stack as={'nav'} spacing={4}>
                        {Links.map((link) => (
                            <NavLink
                                key={link.to}
                                to={link.to}
                                isActive={location.pathname.startsWith(link.to)}
                            >
                                {link.name}
                            </NavLink>
                        ))}
                    </Stack>
                </Box>
            ) : null}
        </Box>
    )
}

export default Navbar
