import { FC, useState } from 'react'
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
    Switch,
    VStack,
    NumberInput,
    NumberInputField,
    NumberInputStepper,
    NumberIncrementStepper,
    NumberDecrementStepper,
    InputGroup,
    InputRightElement,
    IconButton,
    useToast
} from '@chakra-ui/react'
import { ViewIcon, ViewOffIcon } from '@chakra-ui/icons'

interface BoardSettings {
    defaultTimer: number
    hideCardsByDefault: boolean
    hideAuthorNames: boolean
    password?: string
}

interface RetroBoardSettingsModalProps {
    isOpen: boolean
    onClose: () => void
    settings: BoardSettings
    onSave: (settings: BoardSettings) => void
}

const RetroBoardSettingsModal: FC<RetroBoardSettingsModalProps> = ({
    isOpen,
    onClose,
    settings,
    onSave
}) => {
    const [newSettings, setNewSettings] = useState<BoardSettings>({
        defaultTimer: settings.defaultTimer,
        hideCardsByDefault: settings.hideCardsByDefault,
        hideAuthorNames: settings.hideAuthorNames,
        password: ''
    })
    const [showPassword, setShowPassword] = useState(false)
    const toast = useToast()

    const handleSave = () => {
        if (newSettings.defaultTimer < 60) {
            toast({
                title: 'Invalid timer value',
                description: 'Timer must be at least 60 seconds',
                status: 'error',
                duration: 2000,
            })
            return
        }

        onSave({
            ...newSettings,
            password: newSettings.password || undefined
        })
        onClose()
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <ModalOverlay />
            <ModalContent mx={4}>
                <ModalHeader>Board Settings</ModalHeader>
                <ModalBody>
                    <VStack spacing={4}>
                        <FormControl>
                            <FormLabel>Default Timer (seconds)</FormLabel>
                            <NumberInput
                                min={60}
                                value={newSettings.defaultTimer}
                                onChange={(_, value) => setNewSettings((prev: BoardSettings) => ({
                                    ...prev,
                                    defaultTimer: value
                                }))}
                            >
                                <NumberInputField />
                                <NumberInputStepper>
                                    <NumberIncrementStepper />
                                    <NumberDecrementStepper />
                                </NumberInputStepper>
                            </NumberInput>
                        </FormControl>

                        <FormControl display="flex" alignItems="center">
                            <FormLabel mb={0}>Hide Cards by Default</FormLabel>
                            <Switch
                                isChecked={newSettings.hideCardsByDefault}
                                onChange={(e) => setNewSettings((prev: BoardSettings) => ({
                                    ...prev,
                                    hideCardsByDefault: e.target.checked
                                }))}
                            />
                        </FormControl>

                        <FormControl display="flex" alignItems="center">
                            <FormLabel mb={0}>Hide Author Names</FormLabel>
                            <Switch
                                isChecked={newSettings.hideAuthorNames}
                                onChange={(e) => setNewSettings((prev: BoardSettings) => ({
                                    ...prev,
                                    hideAuthorNames: e.target.checked
                                }))}
                            />
                        </FormControl>

                        <FormControl>
                            <FormLabel>Board Password (optional)</FormLabel>
                            <InputGroup>
                                <Input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Leave empty to remove password"
                                    value={newSettings.password}
                                    onChange={(e) => setNewSettings((prev: BoardSettings) => ({
                                        ...prev,
                                        password: e.target.value
                                    }))}
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
                    </VStack>
                </ModalBody>
                <ModalFooter>
                    <Button variant="ghost" mr={3} onClick={onClose}>
                        Cancel
                    </Button>
                    <Button colorScheme="blue" onClick={handleSave}>
                        Save Settings
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    )
}

export default RetroBoardSettingsModal
