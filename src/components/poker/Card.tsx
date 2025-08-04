import { FC, memo } from 'react';
import { Button, useColorMode } from '@chakra-ui/react';

interface CardProps {
  value: string;
  isSelected: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export const Card: FC<CardProps> = memo(({
  value,
  isSelected,
  onClick,
  disabled,
}) => {
  const { colorMode } = useColorMode();

  return (
    <Button
      h={{ base: "100px", md: "120px" }}
      w={{ base: "70px", md: "80px" }}
      fontSize={{ base: "xl", md: "2xl" }}
      variant="outline"
      colorScheme={isSelected ? "blue" : "gray"}
      bg={
        isSelected
          ? colorMode === "light"
            ? "blue.50"
            : "blue.900"
          : "transparent"
      }
      onClick={onClick}
      disabled={disabled}
      _hover={{
        transform: disabled ? "none" : "translateY(-4px)",
        transition: "transform 0.2s",
      }}
    >
      {value}
    </Button>
  );
});

Card.displayName = 'Card';
