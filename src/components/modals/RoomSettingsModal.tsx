import { FC } from 'react'
import {
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    Input,
    VStack,
    FormControl,
    FormLabel,
    Select,
    InputGroup,
    InputRightElement,
    IconButton
} from '@chakra-ui/react'
import { ViewIcon, ViewOffIcon } from '@chakra-ui/icons'
import { SEQUENCE_LABELS, SequenceType } from '../../constants/poker'

interface RoomSettingsModalProps {
    isOpen: boolean
    onClose: () => void
    currentSequence: SequenceType
    newSettings: {
        sequence?: SequenceType
        password?: string
    }
    showPassword: boolean
    onTogglePassword: () => void
    onSettingsChange: (settings: { sequence?: SequenceType; password?: string }) => void
    onSave: () => void
}

const RoomSettingsModal: FC<RoomSettingsModalProps> = ({
    isOpen,
    onClose,
    currentSequence,
    newSettings,
    showPassword,
    onTogglePassword,
    onSettingsChange,
    onSave
}) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <ModalOverlay />
            <ModalContent mx={4}>
                <ModalHeader>Room Settings</ModalHeader>
                <ModalBody>
                    <VStack spacing={4}>
                        <FormControl>
                            <FormLabel>Estimation Sequence</FormLabel>
                            <Select
                                value={newSettings.sequence || currentSequence}
                                onChange={(e) => onSettingsChange({
                                    ...newSettings,
                                    sequence: e.target.value as SequenceType
                                })}
                            >
                                {Object.entries(SEQUENCE_LABELS).map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl>
                            <FormLabel>Change Room Password</FormLabel>
                            <InputGroup>
                                <Input
                                    type={showPassword ? 'text' : 'password'}
                                    placeholder="Enter new password (optional)"
                                    value={newSettings.password || ''}
                                    onChange={(e) => onSettingsChange({
                                        ...newSettings,
                                        password: e.target.value || undefined
                                    })}
                                />
                                <InputRightElement>
                                    <IconButton
                                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                                        icon={showPassword ? <ViewOffIcon /> : <ViewIcon />}
                                        onClick={onTogglePassword}
                                        size="sm"
                                        variant="ghost"
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
                    <Button colorScheme="blue" onClick={onSave}>
                        Save Changes
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    )
}

export default RoomSettingsModal
