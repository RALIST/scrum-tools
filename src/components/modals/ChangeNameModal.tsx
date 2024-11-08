import { FC } from 'react'
import {
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
    Input
} from '@chakra-ui/react'

interface ChangeNameModalProps {
    isOpen: boolean
    newUserName: string
    onClose: () => void
    onNameChange: (value: string) => void
    onSave: () => void
}

const ChangeNameModal: FC<ChangeNameModalProps> = ({
    isOpen,
    newUserName,
    onClose,
    onNameChange,
    onSave
}) => {
    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <ModalOverlay />
            <ModalContent mx={4}>
                <ModalHeader>Change Name</ModalHeader>
                <ModalBody>
                    <Input
                        placeholder="Enter new name"
                        value={newUserName}
                        onChange={(e) => onNameChange(e.target.value)}
                    />
                </ModalBody>
                <ModalFooter>
                    <Button variant="ghost" mr={3} onClick={onClose}>
                        Cancel
                    </Button>
                    <Button colorScheme="blue" onClick={onSave}>
                        Save
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    )
}

export default ChangeNameModal
