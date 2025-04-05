import { FC } from "react";
import {
  Box,
  Container,
  Text,
  HStack,
  useColorMode,
  Link,
  Spacer,
} from "@chakra-ui/react";

const Footer: FC = () => {
  const { colorMode } = useColorMode();

  return (
    <Box
      as="footer"
      py={4}
      borderTop="1px"
      borderColor={colorMode === "light" ? "gray.200" : "gray.700"}
      bg={colorMode === "light" ? "white" : "gray.800"}
    >
      <Container maxW="container.xl">
        <HStack justify="space-between" align="center">
          <Text
            fontSize="sm"
            color={colorMode === "light" ? "gray.600" : "gray.400"}
          >
            © {new Date().getFullYear()} Scrum Tools. All rights reserved.
          </Text>
          <Spacer />
          <HStack spacing={4}>
            <Link
              href="https://online-dev-tools.com/"
              isExternal
              fontSize="sm"
              color={colorMode === "light" ? "blue.600" : "blue.300"}
            >
              Online Dev Tools
            </Link>
            <Link
              href="mailto:dev@scrumtools.app"
              isExternal
              fontSize="sm"
              color={colorMode === "light" ? "blue.600" : "blue.300"}
            >
              Contactme: dev@scrumtools.app
            </Link>
          </HStack>
        </HStack>
      </Container>
    </Box>
  );
};

export default Footer;
