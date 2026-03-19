import {
  Box,
  Container,
  Heading,
  LinkBox,
  LinkOverlay,
  SimpleGrid,
  Text,
  VStack,
} from '@chakra-ui/react';
import type { FC } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import PageHelmet from '../../components/PageHelmet';
import RelatedTools from '../../components/RelatedTools';
import config from '../../config';
import { comparisonList } from '../../content/comparisons';

const CompareIndex: FC = () => {
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: 'Compare Scrum Tools',
      description: 'See how Scrum Tools compares to Miro, Jira, Retrium, and Parabol for agile ceremonies.',
      url: `${config.siteUrl}/compare`,
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
          name: 'Compare',
          item: `${config.siteUrl}/compare`,
        },
      ],
    },
  ];

  return (
    <Container maxW="container.lg" py={8}>
      <PageHelmet
        title="Compare Scrum Tools | Free Alternative to Miro, Jira, Retrium & More"
        description="See how Scrum Tools compares to popular agile tools like Miro, Jira, Retrium, and Parabol. Free Planning Poker, Retro Board, Standup Timer, and Velocity Tracker."
        keywords="scrum tools comparison, miro alternative, jira alternative, retrium alternative, parabol alternative, free agile tools"
        canonicalUrl={`${config.siteUrl}/compare`}
        jsonLd={jsonLd}
      />

      <VStack spacing={8} align="stretch">
        <Box textAlign="center">
          <Heading as="h1" size="2xl" mb={3}>
            Compare Scrum Tools
          </Heading>
          <Text fontSize="xl" color="text.secondary" maxW="600px" mx="auto">
            See how our free agile tools compare to popular alternatives
          </Text>
        </Box>

        <SimpleGrid columns={{ base: 1, md: 2 }} spacing={6}>
          {comparisonList.map((comparison) => (
            <LinkBox
              key={comparison.slug}
              p={6}
              borderWidth="1px"
              borderRadius="lg"
              bg="bg.surface"
              _hover={{ shadow: 'md', transform: 'translateY(-2px)' }}
              transition="all 0.2s"
            >
              <Heading as="h2" size="md" mb={2}>
                <LinkOverlay as={RouterLink} to={`/compare/${comparison.slug}`}>
                  Scrum Tools vs {comparison.competitorName}
                </LinkOverlay>
              </Heading>
              <Text color="text.secondary" noOfLines={3}>
                {comparison.metaDescription}
              </Text>
            </LinkBox>
          ))}
        </SimpleGrid>

        <RelatedTools currentPath="/compare" />
      </VStack>
    </Container>
  );
};

export default CompareIndex;
