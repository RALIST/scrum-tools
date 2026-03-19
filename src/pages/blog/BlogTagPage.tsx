import {
  Box,
  Container,
  Heading,
  Link,
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
import { Link as RouterLink, useParams } from 'react-router-dom';
import PageHelmet from '../../components/PageHelmet';
import RelatedTools from '../../components/RelatedTools';
import config from '../../config';
import { getPostsByTag } from '../../utils/blogUtils';

const BlogTagPage: FC = () => {
  const { tag } = useParams<{ tag: string }>();
  const posts = tag ? getPostsByTag(tag) : [];

  if (!tag || posts.length === 0) {
    return (
      <Container maxW="container.md" py={16}>
        <VStack spacing={4} textAlign="center">
          <Heading>No Posts Found</Heading>
          <Text color="text.secondary">
            No blog posts found for this tag.
          </Text>
          <Link as={RouterLink} to="/blog" color="blue.500" fontWeight="medium">
            Back to Blog
          </Link>
        </VStack>
      </Container>
    );
  }

  const displayTag = tag.replace(/-/g, ' ');

  const jsonLd = {
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
      {
        '@type': 'ListItem',
        position: 3,
        name: `Tag: ${displayTag}`,
        item: `${config.siteUrl}/blog/tag/${tag}`,
      },
    ],
  };

  return (
    <Container maxW="container.lg" py={8}>
      <PageHelmet
        title={`Posts tagged "${displayTag}" - Scrum Tools Blog`}
        description={`Blog posts about ${displayTag}. Guides and tips for agile teams.`}
        keywords={`${tag}, agile, scrum, blog`}
        canonicalUrl={`${config.siteUrl}/blog/tag/${tag}`}
        jsonLd={jsonLd}
      />

      <VStack spacing={8} align="stretch">
        <Box>
          <Link
            as={RouterLink}
            to="/blog"
            color="blue.500"
            fontWeight="medium"
            fontSize="sm"
            mb={4}
            display="inline-block"
          >
            &larr; All Posts
          </Link>
          <Heading as="h1" size="xl" mt={2}>
            Posts tagged &ldquo;{displayTag}&rdquo;
          </Heading>
          <Text color="text.secondary" mt={1}>
            {posts.length} {posts.length === 1 ? 'post' : 'posts'}
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
                  {post.tags.map((t) => (
                    <WrapItem key={t}>
                      <ChakraTag
                        as={RouterLink}
                        to={`/blog/tag/${t}`}
                        size="sm"
                        colorScheme={t === tag ? 'blue' : 'gray'}
                        cursor="pointer"
                        _hover={{ opacity: 0.8 }}
                      >
                        {t}
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

export default BlogTagPage;
