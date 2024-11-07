import { FC, useState } from 'react'
import { Box, Flex, Link, Button, useColorMode, IconButton, VStack, Drawer, DrawerBody, DrawerHeader, DrawerOverlay, DrawerContent, DrawerCloseButton, useDisclosure } from '@chakra-ui/react'
import { Link as RouterLink } from 'react-router-dom'
import { HamburgerIcon } from '@chakra-ui/icons'

const Navbar: FC = () => {
    const { colorMode, toggleColorMode } = useColorMode()
    const { isOpen, onOpen, onClose } = useDisclosure()

    const NavLinks = () => (
        <>
            <Link as={RouterLink} to="/planning-poker" _hover={{ textDecoration: 'none' }}>
                Planning Poker
            </Link>
            <Link as={RouterLink} to="/daily-standup" _hover={{ textDecoration: 'none' }}>
                Daily Standup
            </Link>
        </>
    )

    return (
        <Box as="nav" bg={colorMode === 'light' ? 'white' : 'gray.800'} px={4} py={3} shadow="md">
            <Flex maxW="1200px" mx="auto" align="center" justify="space-between">
                <Flex align="center" gap={8}>
                    <Link as={RouterLink} to="/" fontSize="xl" fontWeight="bold" _hover={{ textDecoration: 'none' }}>
                        Scrum Tools
                    </Link>
                    {/* Desktop Navigation */}
                    <Flex gap={4} display={{ base: 'none', md: 'flex' }}>
                        <NavLinks />
                    </Flex>
                </Flex>

                <Flex align="center" gap={2}>
                    <Button onClick={toggleColorMode} size={{ base: 'sm', md: 'md' }}>
                        {colorMode === 'light' ? 'Dark' : 'Light'} Mode
                    </Button>
                    {/* Mobile Menu Button */}
                    <IconButton
                        aria-label="Open menu"
                        icon={<HamburgerIcon />}
                        display={{ base: 'flex', md: 'none' }}
                        onClick={onOpen}
                        size="md"
                    />
                </Flex>
            </Flex>

            {/* Mobile Navigation Drawer */}
            <Drawer isOpen={isOpen} placement="right" onClose={onClose}>
                <DrawerOverlay />
                <DrawerContent>
                    <DrawerCloseButton />
                    <DrawerHeader>Menu</DrawerHeader>
                    <DrawerBody>
                        <VStack spacing={4} align="start" onClick={onClose}>
                            <NavLinks />
                        </VStack>
                    </DrawerBody>
                </DrawerContent>
            </Drawer>
        </Box>
    )
}

export default Navbar
