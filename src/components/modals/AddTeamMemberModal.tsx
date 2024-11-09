import { FC, useState } from 'react'
import {
    Modal,
    ModalOverlay,
    ModalContent,
    ModalHeader,
    ModalFooter,
    ModalBody,
    ModalCloseButton,
    Button,
    FormControl,
    FormLabel,
    Input,
    FormErrorMessage,
} from '@chakra-ui/react'

interface AddTeamMemberModalProps {
    isOpen: boolean
    onClose: () => void
    onSubmit: (name: string) => void
}

const AddTeamMemberModal: FC<AddTeamMemberModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
}) => {
    const [name, setName] = useState('')
    const [error, setError] = useState('')

    const handleSubmit = () => {
        if (!name.trim()) {
            setError('Name is required')
            return
        }
        onSubmit(name.trim())
        setName('')
        setError('')
        onClose()
    }

    const handleClose = () => {
        setName('')
        setError('')
        onClose()
    }

    return (
        <Modal isOpen={isOpen} onClose={handleClose}>
            <ModalOverlay />
            <ModalContent>
                <ModalHeader>Add Team Member</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                    <FormControl isInvalid={!!error}>
                        <FormLabel>Name</FormLabel>
                        <Input
                            value={name}
                            onChange={(e) => {
                                setName(e.target.value)
                                setError('')
                            }}
                            placeholder="Enter team member name"
                            onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                    handleSubmit()
                                }
                            }}
                        />
                        <FormErrorMessage>{error}</FormErrorMessage>
                    </FormControl>
                </ModalBody>

                <ModalFooter>
                    <Button variant="ghost" mr={3} onClick={handleClose}>
                        Cancel
                    </Button>
                    <Button colorScheme="blue" onClick={handleSubmit}>
                        Add Member
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    )
}

export default AddTeamMemberModal
