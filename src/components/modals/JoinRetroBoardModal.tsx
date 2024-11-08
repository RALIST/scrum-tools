import { FC, useState, useEffect } from 'react'
import {
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    FormControl,
    FormLabel,
    Input,
    VStack,
    InputGroup,
    InputRightElement,
    IconButton,
    useToast
} from '@chakra-ui/react'
import { ViewIcon, ViewOffIcon } from '@chakra-ui/icons'

interface JoinRetroBoardModalProps {
    isOpen: boolean
    onClose: () => void
    onJoin: (name: string, password?: string) => void
    hasPassword?: boolean
}

const JoinRetroBoardModal: FC<JoinRetroBoardModalProps> = ({
    isOpen,
    onClose,
    onJoin,
    hasPassword
}) => {
    const [name, setName] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const toast = useToast()

    useEffect(() => {
        const savedName = localStorage.getItem('retroUserName')
        if (savedName) {
            setName(savedName)
        }
    }, [])

    const handleJoin = () => {
        if (!name.trim()) {
            toast({
                title: 'Error',
                description: 'Please enter your name',
                status: 'error',
                duration: 2000,
            })
            return
        }

        if (hasPassword && !password.trim()) {
            toast({
                title: 'Error',
                description: 'Please enter the board password',
                status: 'error',
                duration: 2000,
            })
            return
        }

        localStorage.setItem('retroUserName', name.trim())
        onJoin(name.trim(), hasPassword ? password : undefined)
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose} closeOnOverlayClick={false}>
            <ModalOverlay />
            <ModalContent mx={4}>
                <ModalHeader>Join Retro Board</ModalHeader>
                <ModalBody>
                    <VStack spacing={4}>
                        <FormControl isRequired>
                            <FormLabel>Your Name</FormLabel>
                            <Input
                                placeholder="Enter your name"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter' && (!hasPassword || password)) {
                                        handleJoin()
                                    }
                                }}
                            />
                        </FormControl>

                        {hasPassword && (
                            <FormControl isRequired>
                                <FormLabel>Board Password</FormLabel>
                                <InputGroup>
                                    <Input
                                        type={showPassword ? 'text' : 'password'}
                                        placeholder="Enter board password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter' && name) {
                                                handleJoin()
                                            }
                                        }}
                                    />
                                    <InputRightElement>
                                        <IconButton
                                            aria-label={showPassword ? "Hide password" : "Show password"}
                                            icon={showPassword ? <ViewOffIcon /> : <ViewIcon />}
                                            onClick={() => setShowPassword(!showPassword)}
                                            variant="ghost"
                                            size="sm"
                                        />
                                    </InputRightElement>
                                </InputGroup>
                            </FormControl>
                        )}
                    </VStack>
                </ModalBody>
                <ModalFooter>
                    <Button colorScheme="blue" onClick={handleJoin}>
                        Join Board
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    )
}

export default JoinRetroBoardModal
