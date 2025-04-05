import React, { FC } from "react"; // Import React
import { Box, Input, Button, useToast } from "@chakra-ui/react";
import { AddIcon } from "@chakra-ui/icons";

interface RetroCardInputProps {
  isTimerRunning: boolean;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  userName: string;
}

const RetroCardInput: FC<RetroCardInputProps> = ({
  isTimerRunning,
  value,
  onChange,
  onSubmit,
  userName,
}) => {
  const toast = useToast();

  const handleSubmit = () => {
    if (!value.trim() || !isTimerRunning || !userName) {
      if (!userName) {
        toast({
          title: "Error",
          description: "Please enter your name first",
          status: "error",
          duration: 2000,
        });
      }
      return;
    }
    onSubmit();
  };

  return (
    <Box>
      <Input
        placeholder={isTimerRunning ? "Add a new card" : "Timer is paused"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyPress={(e) => {
          if (e.key === "Enter" && isTimerRunning) {
            handleSubmit();
          }
        }}
        disabled={!isTimerRunning}
      />
      <Button
        leftIcon={<AddIcon />}
        mt={2}
        w="full"
        onClick={handleSubmit}
        disabled={!isTimerRunning}
      >
        Add Card
      </Button>
    </Box>
  );
};

export default React.memo(RetroCardInput); // Memoize the component
