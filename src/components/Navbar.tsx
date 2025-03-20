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
    Button,
    Avatar,
    Text,
    Divider,
    Flex,
    Spacer,
    Badge
} from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'
import { MoonIcon, SunIcon, HamburgerIcon, ChevronDownIcon } from '@chakra-ui/icons'
import { useAuth } from '../contexts/AuthContext'
import { useWorkspace } from '../contexts/WorkspaceContext'
import { FaUsers } from 'react-icons/fa'

const Navbar: FC = () => {
    const { colorMode, toggleColorMode } = useColorMode()
    const { user, isAuthenticated, logout } = useAuth()
    const { currentWorkspace, workspaces, setCurrentWorkspace } = useWorkspace()
    const isMobile = useBreakpointValue({ base: true, md: false })

    const NavLinks = () => (
        <>
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

    const UserMenu = () => (
        <Menu>
            <MenuButton
                as={Button}
                variant="ghost"
                rightIcon={<ChevronDownIcon />}
                rounded="full"
                pl={2}
                pr={4}
            >
                <HStack>
                    <Avatar size="xs" name={user?.name} bg="blue.500" />
                    <Text display={{ base: 'none', md: 'block' }}>{user?.name}</Text>
                </HStack>
            </MenuButton>
            <MenuList>
                <MenuItem as={RouterLink} to="/profile">My Profile</MenuItem>
                <MenuItem as={RouterLink} to="/workspaces">My Workspaces</MenuItem>
                <Divider />
                <MenuItem onClick={logout}>Log Out</MenuItem>
            </MenuList>
        </Menu>
    )

    const WorkspaceMenu = () => {
        if (!currentWorkspace) return null;
        
        return (
            <Menu>
                <MenuButton
                    as={Button}
                    variant="outline"
                    colorScheme="blue"
                    leftIcon={<FaUsers />}
                    rightIcon={<ChevronDownIcon />}
                    size="sm"
                >
                    <Text noOfLines={1} maxW="120px">
                        {currentWorkspace.name}
                    </Text>
                </MenuButton>
                <MenuList>
                    <MenuItem as={RouterLink} to={`/workspaces/${currentWorkspace.id}`}>
                        Workspace Details
                    </MenuItem>
                    <Divider />
                    {workspaces && workspaces.map(workspace => (
                        <MenuItem 
                            key={workspace.id} 
                            onClick={() => {
                                    setCurrentWorkspace(workspace);
                                    localStorage.setItem('currentWorkspace', workspace.name)
                                    localStorage.setItem('currentWorkspaceId', workspace.id)
                                }
                            }
                            fontWeight={workspace.id === currentWorkspace.id ? 'bold' : 'normal'}
                        >
                            {workspace.name}
                            {workspace.id === currentWorkspace.id && (
                                <Badge ml={2} colorScheme="green" size="sm">Active</Badge>
                            )}
                        </MenuItem>
                    ))}
                    <Divider />
                    <MenuItem as={RouterLink} to="/workspaces">
                        All Workspaces
                    </MenuItem>
                </MenuList>
            </Menu>
        );
    };

    const AuthButtons = () => (
        <HStack spacing={2}>
            <Button 
                as={RouterLink} 
                to="/login" 
                variant="outline" 
                colorScheme="blue" 
                size="sm"
            >
                Log In
            </Button>
            <Button 
                as={RouterLink} 
                to="/register" 
                colorScheme="blue" 
                size="sm"
            >
                Register
            </Button>
        </HStack>
    );

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
                            Scrum Tools
                        </Link>
                        <HStack>
                            {isAuthenticated && <WorkspaceMenu />}
                            <ThemeToggle />
                            
                            <Menu>
                                <MenuButton
                                    as={Button}
                                    variant="ghost"
                                    rightIcon={<HamburgerIcon />}
                                />
                                <MenuList>
                                    <MenuItem as={RouterLink} to="/">
                                        Home
                                    </MenuItem>
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
                                    <Divider />
                                    {isAuthenticated ? (
                                        <>
                                            <MenuItem as={RouterLink} to="/profile">
                                                My Profile
                                            </MenuItem>
                                            <MenuItem as={RouterLink} to="/workspaces">
                                                My Workspaces
                                            </MenuItem>
                                            <MenuItem onClick={logout}>
                                                Log Out
                                            </MenuItem>
                                        </>
                                    ) : (
                                        <>
                                            <MenuItem as={RouterLink} to="/login">
                                                Log In
                                            </MenuItem>
                                            <MenuItem as={RouterLink} to="/register">
                                                Register
                                            </MenuItem>
                                        </>
                                    )}
                                </MenuList>
                            </Menu>
                        </HStack>
                    </HStack>
                ) : (
                    <Flex align="center" width="100%">
                        <HStack spacing={8}>
                            <Link
                                as={RouterLink}
                                to="/"
                                fontSize="xl"
                                fontWeight="bold"
                                _hover={{ textDecoration: 'none', color: 'blue.500' }}
                            >
                                Scrum Tools
                            </Link>
                            <NavLinks />
                        </HStack>
                        
                        <Spacer />
                        
                        <HStack spacing={4}>
                            {isAuthenticated && currentWorkspace && <WorkspaceMenu />}
                            <ThemeToggle />
                            {isAuthenticated ? <UserMenu /> : <AuthButtons />}
                        </HStack>
                    </Flex>
                )}
            </Container>
        </Box>
    )
}

export default Navbar
