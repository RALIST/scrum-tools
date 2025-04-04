import { FC } from "react";
import {
  VStack,
  Button,
  FormControl,
  FormLabel,
  Input,
  Grid,
  GridItem,
  Card,
  CardBody,
  HStack,
  FormErrorMessage,
} from "@chakra-ui/react";

interface FormErrors {
  teamName?: string;
  teamPassword?: string;
}

interface TeamSetupFormProps {
  teamName: string;
  teamPassword?: string; // Password might not be needed if team is loaded/changed
  isTeamLoaded: boolean;
  errors: FormErrors;
  onNameChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: () => void;
  onChangeTeam: () => void;
  onAddSprintClick: () => void; // Add this prop
}

export const TeamSetupForm: FC<TeamSetupFormProps> = ({
  teamName,
  teamPassword,
  isTeamLoaded,
  errors,
  onNameChange,
  onPasswordChange,
  onSubmit,
  onChangeTeam,
  onAddSprintClick, // Receive the handler
}) => {
  return (
    <Card w="full">
      <CardBody>
        <VStack spacing={4}>
          <Grid
            templateColumns={{ base: "1fr", md: "repeat(2, 1fr)" }}
            gap={4}
            width="100%"
          >
            <GridItem>
              <FormControl isInvalid={!!errors.teamName} isRequired>
                <FormLabel>Team Name</FormLabel>
                <Input
                  value={teamName}
                  onChange={(e) => onNameChange(e.target.value)}
                  placeholder="Enter team name"
                  isDisabled={isTeamLoaded}
                />
                <FormErrorMessage>{errors.teamName}</FormErrorMessage>
              </FormControl>
            </GridItem>
            <GridItem>
              <FormControl isInvalid={!!errors.teamPassword} isRequired>
                <FormLabel>Team Password</FormLabel>
                <Input
                  type="password"
                  value={teamPassword || ""} // Handle potential undefined
                  onChange={(e) => onPasswordChange(e.target.value)}
                  placeholder="Enter team password"
                  isDisabled={isTeamLoaded}
                />
                <FormErrorMessage>{errors.teamPassword}</FormErrorMessage>
              </FormControl>
            </GridItem>
          </Grid>
          <HStack spacing={4}>
            {!isTeamLoaded ? (
              <Button colorScheme="blue" onClick={onSubmit}>
                Create/Load Team
              </Button>
            ) : (
              <>
                <Button colorScheme="green" onClick={onAddSprintClick}>
                  Add Sprint Data
                </Button>
                <Button
                  colorScheme="blue"
                  variant="outline"
                  onClick={onChangeTeam}
                >
                  Change Team
                </Button>
              </>
            )}
          </HStack>
        </VStack>
      </CardBody>
    </Card>
  );
};
