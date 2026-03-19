import {
  Box,
  Container,
  Heading,
  LinkBox,
  LinkOverlay,
  SimpleGrid,
  Tag as ChakraTag,
  Text,
  VStack,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import type { FC } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import PageHelmet from '../../components/PageHelmet';
import RelatedTools from '../../components/RelatedTools';
import config from '../../config';
import { getAllPosts } from '../../utils/blogUtils';

const BlogIndex: FC = () => {
  const posts = getAllPosts();

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Blog',
      name: 'Scrum Tools Blog',
      description: 'Guides, tips, and best practices for agile teams using Scrum.',
      url: `${config.siteUrl}/blog`,
      publisher: {
        '@type': 'Organization',
        name: 'Scrum Tools',
        url: config.siteUrl,
      },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Home',
          item: config.siteUrl,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Blog',
          item: `${config.siteUrl}/blog`,
        },
      ],
    },
  ];

  return (
    <Container maxW="container.lg" py={8}>
      <PageHelmet
        title="Blog - Scrum Tools | Agile Guides & Best Practices"
        description="Guides, tips, and best practices for agile teams. Learn how to run effective retrospectives, estimate with Planning Poker, track velocity, and more."
        keywords="agile blog, scrum blog, retrospective guide, planning poker tips, team velocity, daily standup"
        canonicalUrl={`${config.siteUrl}/blog`}
        jsonLd={jsonLd}
      />

      <VStack spacing={8} align="stretch">
        <Box textAlign="center">
          <Heading as="h1" size="2xl" mb={3}>
            Blog
          </Heading>
          <Text fontSize="xl" color="text.secondary" maxW="600px" mx="auto">
            Guides, tips, and best practices for agile teams
          </Text>
        </Box>

        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
          {posts.map((post) => (
            <LinkBox
              key={post.slug}
              p={6}
              borderWidth="1px"
              borderRadius="lg"
              bg="bg.surface"
              _hover={{ shadow: 'md', transform: 'translateY(-2px)' }}
              transition="all 0.2s"
            >
              <Text fontSize="sm" color="text.secondary" mb={2}>
                {new Date(post.date).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </Text>
              <Heading as="h2" size="md" mb={2}>
                <LinkOverlay as={RouterLink} to={`/blog/${post.slug}`}>
                  {post.title}
                </LinkOverlay>
              </Heading>
              <Text color="text.secondary" noOfLines={3} mb={3}>
                {post.description}
              </Text>
              {post.tags.length > 0 && (
                <Wrap spacing={2} position="relative" zIndex={1}>
                  {post.tags.map((tag) => (
                    <WrapItem key={tag}>
                      <ChakraTag
                        as={RouterLink}
                        to={`/blog/tag/${tag}`}
                        size="sm"
                        colorScheme="gray"
                        cursor="pointer"
                        _hover={{ opacity: 0.8 }}
                      >
                        {tag}
                      </ChakraTag>
                    </WrapItem>
                  ))}
                </Wrap>
              )}
            </LinkBox>
          ))}
        </SimpleGrid>

        <RelatedTools currentPath="/blog" />
      </VStack>
    </Container>
  );
};

export default BlogIndex;
