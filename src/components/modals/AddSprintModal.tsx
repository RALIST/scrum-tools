import { FC, useState } from "react";
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
  FormErrorMessage,
  Input,
  NumberInput,
  NumberInputField,
  Grid,
  GridItem,
  VStack,
} from "@chakra-ui/react";

interface AddSprintModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    sprintName: string;
    startDate: string;
    endDate: string;
    committedPoints: string;
    completedPoints: string;
  }) => void;
  sprintName: string;
  startDate: string;
  endDate: string;
  committedPoints: string;
  completedPoints: string;
  onSprintNameChange: (value: string) => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onCommittedPointsChange: (value: string) => void;
  onCompletedPointsChange: (value: string) => void;
  isSubmitting?: boolean; // Add optional loading state prop
}

interface FormErrors {
  sprintName?: string;
  startDate?: string;
  endDate?: string;
  committedPoints?: string;
  completedPoints?: string;
}

const AddSprintModal: FC<AddSprintModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  sprintName,
  startDate,
  endDate,
  committedPoints,
  completedPoints,
  onSprintNameChange,
  onStartDateChange,
  onEndDateChange,
  onCommittedPointsChange,
  onCompletedPointsChange,
  isSubmitting = false, // Destructure with default value
}) => {
  const [formErrors, setFormErrors] = useState<FormErrors>({});

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    let isValid = true;

    if (!sprintName.trim()) {
      errors.sprintName = "Sprint name is required";
      isValid = false;
    }

    if (!startDate) {
      errors.startDate = "Start date is required";
      isValid = false;
    }

    if (!endDate) {
      errors.endDate = "End date is required";
      isValid = false;
    } else if (new Date(endDate) <= new Date(startDate)) {
      errors.endDate = "End date must be after start date";
      isValid = false;
    }

    if (!committedPoints || parseInt(committedPoints) <= 0) {
      errors.committedPoints = "Committed points must be greater than 0";
      isValid = false;
    }

    if (!completedPoints || parseInt(completedPoints) < 0) {
      errors.completedPoints = "Completed points must be 0 or greater";
      isValid = false;
    }

    setFormErrors(errors);
    return isValid;
  };

  const handleSubmit = () => {
    if (validateForm()) {
      onSubmit({
        sprintName,
        startDate,
        endDate,
        committedPoints,
        completedPoints,
      });
    }
  };

  const handleClose = () => {
    setFormErrors({});
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Add Sprint Data</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4}>
            <Grid templateColumns="repeat(2, 1fr)" gap={4} width="100%">
              <GridItem colSpan={2}>
                <FormControl isInvalid={!!formErrors.sprintName}>
                  <FormLabel>Sprint Name</FormLabel>
                  <Input
                    value={sprintName}
                    onChange={(e) => {
                      onSprintNameChange(e.target.value);
                      setFormErrors((prev) => ({
                        ...prev,
                        sprintName: undefined,
                      }));
                    }}
                    placeholder="e.g., Sprint 1"
                  />
                  <FormErrorMessage>{formErrors.sprintName}</FormErrorMessage>
                </FormControl>
              </GridItem>
              <GridItem>
                <FormControl isInvalid={!!formErrors.startDate}>
                  <FormLabel>Start Date</FormLabel>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => {
                      onStartDateChange(e.target.value);
                      setFormErrors((prev) => ({
                        ...prev,
                        startDate: undefined,
                      }));
                    }}
                  />
                  <FormErrorMessage>{formErrors.startDate}</FormErrorMessage>
                </FormControl>
              </GridItem>
              <GridItem>
                <FormControl isInvalid={!!formErrors.endDate}>
                  <FormLabel>End Date</FormLabel>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => {
                      onEndDateChange(e.target.value);
                      setFormErrors((prev) => ({
                        ...prev,
                        endDate: undefined,
                      }));
                    }}
                  />
                  <FormErrorMessage>{formErrors.endDate}</FormErrorMessage>
                </FormControl>
              </GridItem>
              <GridItem>
                <FormControl isInvalid={!!formErrors.committedPoints}>
                  <FormLabel>Committed Points</FormLabel>
                  <NumberInput
                    min={0}
                    value={committedPoints}
                    onChange={(value) => {
                      onCommittedPointsChange(value);
                      setFormErrors((prev) => ({
                        ...prev,
                        committedPoints: undefined,
                      }));
                    }}
                  >
                    <NumberInputField placeholder="Enter points" />
                  </NumberInput>
                  <FormErrorMessage>
                    {formErrors.committedPoints}
                  </FormErrorMessage>
                </FormControl>
              </GridItem>
              <GridItem>
                <FormControl isInvalid={!!formErrors.completedPoints}>
                  <FormLabel>Completed Points</FormLabel>
                  <NumberInput
                    min={0}
                    value={completedPoints}
                    onChange={(value) => {
                      onCompletedPointsChange(value);
                      setFormErrors((prev) => ({
                        ...prev,
                        completedPoints: undefined,
                      }));
                    }}
                  >
                    <NumberInputField placeholder="Enter points" />
                  </NumberInput>
                  <FormErrorMessage>
                    {formErrors.completedPoints}
                  </FormErrorMessage>
                </FormControl>
              </GridItem>
            </Grid>
          </VStack>
        </ModalBody>

        <ModalFooter>
          <Button
            variant="ghost"
            mr={3}
            onClick={handleClose}
            isDisabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            colorScheme="blue"
            onClick={handleSubmit}
            isLoading={isSubmitting} // Use the prop here
            isDisabled={isSubmitting}
          >
            Add Sprint
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default AddSprintModal;
