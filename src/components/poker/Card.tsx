import { Button } from '@chakra-ui/react';
import { type FC, memo } from 'react';

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
  return (
    <Button
      h={{ base: "100px", md: "120px" }}
      w={{ base: "70px", md: "80px" }}
      fontSize={{ base: "xl", md: "2xl" }}
      variant="outline"
      colorScheme={isSelected ? "blue" : "gray"}
      bg={isSelected ? "bg.selected" : "transparent"}
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
