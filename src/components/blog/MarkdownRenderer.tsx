import {
  Box,
  Code,
  Heading,
  Link,
  ListItem,
  OrderedList,
  Text,
  UnorderedList,
} from '@chakra-ui/react';
import type { FC } from 'react';
import type { Components } from 'react-markdown';
import ReactMarkdown from 'react-markdown';
import { Link as RouterLink } from 'react-router-dom';

interface MarkdownRendererProps {
  content: string;
}

function isInternalLink(href: string): boolean {
  return href.startsWith('/');
}

const components: Components = {
  h1: ({ children }) => (
    <Heading as="h1" size="2xl" mt={8} mb={4}>
      {children}
    </Heading>
  ),
  h2: ({ children }) => (
    <Heading as="h2" size="xl" mt={8} mb={3}>
      {children}
    </Heading>
  ),
  h3: ({ children }) => (
    <Heading as="h3" size="lg" mt={6} mb={2}>
      {children}
    </Heading>
  ),
  h4: ({ children }) => (
    <Heading as="h4" size="md" mt={4} mb={2}>
      {children}
    </Heading>
  ),
  p: ({ children }) => (
    <Text mb={4} lineHeight="tall" fontSize="lg">
      {children}
    </Text>
  ),
  a: ({ href, children }) => {
    if (href && isInternalLink(href)) {
      return (
        <Link as={RouterLink} to={href} color="blue.500" fontWeight="medium">
          {children}
        </Link>
      );
    }
    return (
      <Link href={href} color="blue.500" isExternal fontWeight="medium">
        {children}
      </Link>
    );
  },
  ul: ({ children }) => (
    <UnorderedList spacing={2} mb={4} pl={4}>
      {children}
    </UnorderedList>
  ),
  ol: ({ children }) => (
    <OrderedList spacing={2} mb={4} pl={4}>
      {children}
    </OrderedList>
  ),
  li: ({ children }) => (
    <ListItem fontSize="lg" lineHeight="tall">
      {children}
    </ListItem>
  ),
  blockquote: ({ children }) => (
    <Box
      borderLeftWidth="4px"
      borderLeftColor="blue.500"
      pl={4}
      py={2}
      mb={4}
      fontStyle="italic"
      color="text.secondary"
    >
      {children}
    </Box>
  ),
  code: ({ className, children }) => {
    const isBlock = className?.startsWith('language-');
    if (isBlock) {
      return (
        <Box
          as="pre"
          p={4}
          mb={4}
          borderRadius="md"
          overflowX="auto"
          bg="bg.surface"
          borderWidth="1px"
          borderColor="border.default"
        >
          <Code display="block" whiteSpace="pre" bg="transparent">
            {children}
          </Code>
        </Box>
      );
    }
    return (
      <Code px={1.5} py={0.5} borderRadius="sm">
        {children}
      </Code>
    );
  },
  strong: ({ children }) => (
    <Text as="strong" fontWeight="bold">
      {children}
    </Text>
  ),
  hr: () => <Box as="hr" my={8} borderColor="border.default" />,
};

const MarkdownRenderer: FC<MarkdownRendererProps> = ({ content }) => {
  return <ReactMarkdown components={components}>{content}</ReactMarkdown>;
};

export default MarkdownRenderer;
