import React, { FC } from "react";
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
  Badge,
} from "@chakra-ui/react";
import { Link as RouterLink } from "react-router-dom";
import {
  MoonIcon,
  SunIcon,
  HamburgerIcon,
  ChevronDownIcon,
} from "@chakra-ui/icons";
import { useAuth } from "../contexts/AuthContext";
import { useWorkspace, Workspace } from "../contexts/WorkspaceContext"; // Import Workspace type
import { FaUsers } from "react-icons/fa";

// --- Static Components (Moved Outside) ---

const NavLinks: FC = () => (
  <>
    <Link
      as={RouterLink}
      to="/retro"
      fontSize="lg"
      fontWeight="bold"
      _hover={{ textDecoration: "none", color: "blue.500" }}
    >
      Retro Board
    </Link>
    <Link
      as={RouterLink}
      to="/planning-poker"
      fontSize="lg"
      fontWeight="bold"
      _hover={{ textDecoration: "none", color: "blue.500" }}
    >
      Planning Poker
    </Link>
    <Link
      as={RouterLink}
      to="/daily-standup"
      fontSize="lg"
      fontWeight="bold"
      _hover={{ textDecoration: "none", color: "blue.500" }}
    >
      Daily Standup
    </Link>
    <Link
      as={RouterLink}
      to="/velocity"
      fontSize="lg"
      fontWeight="bold"
      _hover={{ textDecoration: "none", color: "blue.500" }}
    >
      Team Velocity
    </Link>
  </>
);

const ThemeToggle: FC = () => {
  const { colorMode, toggleColorMode } = useColorMode();
  return (
    <Tooltip
      label={`Switch to ${colorMode === "light" ? "dark" : "light"} mode`}
    >
      <IconButton
        aria-label={`Switch to ${
          colorMode === "light" ? "dark" : "light"
        } mode`}
        icon={colorMode === "light" ? <MoonIcon /> : <SunIcon />}
        onClick={toggleColorMode}
        variant="ghost"
        colorScheme="blue"
      />
    </Tooltip>
  );
};

const AuthButtons: FC = () => (
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
    <Button as={RouterLink} to="/register" colorScheme="blue" size="sm">
      Register
    </Button>
  </HStack>
);

// --- Dynamic Components (Memoized) ---

interface UserMenuProps {
  user: ReturnType<typeof useAuth>["user"];
  logout: ReturnType<typeof useAuth>["logout"];
}

// Use React.memo correctly
const UserMenu = React.memo<UserMenuProps>(({ user, logout }) => {
  // console.log("Rendering UserMenu"); // Add log for debugging renders
  return (
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
          <Text display={{ base: "none", md: "block" }}>{user?.name}</Text>
        </HStack>
      </MenuButton>
      <MenuList>
        <MenuItem as={RouterLink} to="/profile">
          My Profile
        </MenuItem>
        <MenuItem as={RouterLink} to="/workspaces">
          My Workspaces
        </MenuItem>
        <Divider />
        <MenuItem onClick={logout}>Log Out</MenuItem>
      </MenuList>
    </Menu>
  );
});
UserMenu.displayName = "UserMenu"; // Add display name for debugging

interface WorkspaceMenuProps {
  currentWorkspace: Workspace | null;
  workspaces: Workspace[] | null;
  onWorkspaceSelect: (workspace: Workspace) => void;
}

// Use React.memo correctly
const WorkspaceMenu = React.memo<WorkspaceMenuProps>(
  ({ currentWorkspace, workspaces, onWorkspaceSelect }) => {
    // console.log("Rendering WorkspaceMenu"); // Add log for debugging renders
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
          {workspaces &&
            workspaces.map((workspace) => (
              <MenuItem
                key={workspace.id}
                onClick={() => onWorkspaceSelect(workspace)} // Use the passed handler
                fontWeight={
                  workspace.id === currentWorkspace.id ? "bold" : "normal"
                }
              >
                {workspace.name}
                {workspace.id === currentWorkspace.id && (
                  <Badge ml={2} colorScheme="green" size="sm">
                    Active
                  </Badge>
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
  }
);
WorkspaceMenu.displayName = "WorkspaceMenu"; // Add display name

// --- Main Navbar Component ---

const Navbar: FC = () => {
  const { colorMode } = useColorMode(); // Only need colorMode here now
  const { user, isAuthenticated, logout } = useAuth();
  // Use the correct name from context 'setCurrentWorkspace' which was memoized as 'updateCurrentWorkspace'
  const {
    currentWorkspace,
    workspaces,
    setCurrentWorkspace: onWorkspaceSelect,
  } = useWorkspace();
  const isMobile = useBreakpointValue({ base: true, md: false });

  // console.log("Rendering Navbar", { isAuthenticated, currentWorkspaceId: currentWorkspace?.id }); // Add log for debugging renders

  return (
    <Box
      as="nav"
      py={4}
      borderBottom="1px"
      borderColor={colorMode === "light" ? "gray.200" : "gray.700"}
      bg={colorMode === "light" ? "white" : "gray.800"}
      position="sticky"
      top={0}
      zIndex="sticky"
    >
      <Container maxW="container.xl">
        {isMobile ? (
          // Mobile View
          <HStack justify="space-between">
            <Link
              as={RouterLink}
              to="/"
              fontSize="lg"
              fontWeight="bold"
              _hover={{ textDecoration: "none", color: "blue.500" }}
            >
              Scrum Tools
            </Link>
            <HStack>
              {/* Use memoized WorkspaceMenu */}
              {isAuthenticated && currentWorkspace && (
                <WorkspaceMenu
                  currentWorkspace={currentWorkspace}
                  workspaces={workspaces}
                  onWorkspaceSelect={onWorkspaceSelect}
                />
              )}
              <ThemeToggle /> {/* Use static component */}
              <Menu>
                <MenuButton
                  as={IconButton} // Use IconButton for icon-only button
                  aria-label="Open menu" // Add aria-label
                  icon={<HamburgerIcon />}
                  variant="ghost" // Keep variant ghost for IconButton
                />
                <MenuList>
                  <MenuItem as={RouterLink} to="/">
                    Home
                  </MenuItem>
                  {/* Add other NavLinks for mobile */}
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
                      <MenuItem onClick={logout}>Log Out</MenuItem>
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
          // Desktop View
          <Flex align="center" width="100%">
            <HStack spacing={8}>
              <Link
                as={RouterLink}
                to="/"
                fontSize="xl"
                fontWeight="bold"
                _hover={{ textDecoration: "none", color: "blue.500" }}
              >
                Scrum Tools
              </Link>
              <NavLinks /> {/* Use static component */}
            </HStack>

            <Spacer />

            <HStack spacing={4}>
              {/* Pass props to memoized components */}
              {isAuthenticated && currentWorkspace && (
                <WorkspaceMenu
                  currentWorkspace={currentWorkspace}
                  workspaces={workspaces}
                  onWorkspaceSelect={onWorkspaceSelect}
                />
              )}
              <ThemeToggle /> {/* Use static component */}
              {isAuthenticated ? (
                <UserMenu user={user} logout={logout} />
              ) : (
                <AuthButtons /> /* Use static component */
              )}
            </HStack>
          </Flex>
        )}
      </Container>
    </Box>
  );
};

export default Navbar;
