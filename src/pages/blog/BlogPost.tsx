import {
  Box,
  Container,
  Heading,
  Link,
  Tag as ChakraTag,
  Text,
  VStack,
  Wrap,
  WrapItem,
} from '@chakra-ui/react';
import type { FC } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import MarkdownRenderer from '../../components/blog/MarkdownRenderer';
import PageHelmet from '../../components/PageHelmet';
import RelatedTools from '../../components/RelatedTools';
import config from '../../config';
import { getPostBySlug } from '../../utils/blogUtils';

const BlogPost: FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const post = slug ? getPostBySlug(slug) : undefined;

  if (!post) {
    return (
      <Container maxW="container.md" py={16}>
        <VStack spacing={4} textAlign="center">
          <Heading>Post Not Found</Heading>
          <Text color="text.secondary">
            The blog post you&apos;re looking for doesn&apos;t exist.
          </Text>
          <Link as={RouterLink} to="/blog" color="blue.500" fontWeight="medium">
            Back to Blog
          </Link>
        </VStack>
      </Container>
    );
  }

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description: post.description,
      datePublished: post.date,
      author: {
        '@type': 'Organization',
        name: 'Scrum Tools',
        url: config.siteUrl,
      },
      publisher: {
        '@type': 'Organization',
        name: 'Scrum Tools',
        url: config.siteUrl,
      },
      mainEntityOfPage: `${config.siteUrl}/blog/${post.slug}`,
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
        {
          '@type': 'ListItem',
          position: 3,
          name: post.title,
          item: `${config.siteUrl}/blog/${post.slug}`,
        },
      ],
    },
  ];

  return (
    <Container maxW="container.md" py={8}>
      <PageHelmet
        title={`${post.title} - Scrum Tools Blog`}
        description={post.description}
        keywords={post.keywords}
        canonicalUrl={`${config.siteUrl}/blog/${post.slug}`}
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
            &larr; Back to Blog
          </Link>
          <Text fontSize="sm" color="text.secondary" mt={2}>
            {new Date(post.date).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </Text>
          {post.tags.length > 0 && (
            <Wrap spacing={2} mt={3}>
              {post.tags.map((tag) => (
                <WrapItem key={tag}>
                  <ChakraTag
                    as={RouterLink}
                    to={`/blog/tag/${tag}`}
                    size="sm"
                    colorScheme="blue"
                    cursor="pointer"
                    _hover={{ opacity: 0.8 }}
                  >
                    {tag}
                  </ChakraTag>
                </WrapItem>
              ))}
            </Wrap>
          )}
        </Box>

        <Box as="article">
          <MarkdownRenderer content={post.content} />
        </Box>

        <RelatedTools currentPath={post.relatedTool} />
      </VStack>
    </Container>
  );
};

export default BlogPost;
