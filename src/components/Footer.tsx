import {
  Box,
  Container,
  Text,
  HStack,
  Link,
  Spacer,
} from "@chakra-ui/react";
import type { FC } from "react";

const Footer: FC = () => {
  return (
    <Box
      as="footer"
      py={4}
      borderTop="1px"
      borderColor="border.default"
      bg="bg.chrome"
    >
      <Container maxW="container.xl">
        <HStack justify="space-between" align="center">
          <Text
            fontSize="sm"
            color="text.footnote"
          >
            © {new Date().getFullYear()} Scrum Tools. All rights reserved.
          </Text>
          <Spacer />
          <HStack spacing={4}>
            <Link
              href="https://online-dev-tools.com/"
              isExternal
              fontSize="sm"
              color="link.accent"
            >
              Online Dev Tools
            </Link>
            <Link
              href="mailto:dev@scrumtools.app"
              isExternal
              fontSize="sm"
              color="link.accent"
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
