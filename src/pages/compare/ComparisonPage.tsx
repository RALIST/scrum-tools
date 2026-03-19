import { CheckIcon, CloseIcon } from '@chakra-ui/icons';
import {
  Box,
  Button,
  Container,
  Heading,
  Link,
  SimpleGrid,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  VStack,
} from '@chakra-ui/react';
import type { FC } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import PageHelmet from '../../components/PageHelmet';
import RelatedTools from '../../components/RelatedTools';
import config from '../../config';
import { comparisons } from '../../content/comparisons';

function renderFeatureValue(value: string | boolean): React.ReactNode {
  if (value === true) return <CheckIcon color="green.500" />;
  if (value === false) return <CloseIcon color="red.400" boxSize={3} />;
  return value;
}

const ComparisonPage: FC = () => {
  const { tool } = useParams<{ tool: string }>();
  const comparison = tool ? comparisons[tool] : undefined;

  if (!comparison) {
    return (
      <Container maxW="container.md" py={16}>
        <VStack spacing={4} textAlign="center">
          <Heading>Comparison Not Found</Heading>
          <Text color="text.secondary">
            The comparison you&apos;re looking for doesn&apos;t exist.
          </Text>
          <Link as={RouterLink} to="/compare" color="blue.500" fontWeight="medium">
            View All Comparisons
          </Link>
        </VStack>
      </Container>
    );
  }

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: comparison.pageTitle,
      description: comparison.metaDescription,
      url: `${config.siteUrl}/compare/${comparison.slug}`,
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
        {
          '@type': 'ListItem',
          position: 3,
          name: `vs ${comparison.competitorName}`,
          item: `${config.siteUrl}/compare/${comparison.slug}`,
        },
      ],
    },
  ];

  return (
    <Container maxW="container.lg" py={8}>
      <PageHelmet
        title={comparison.pageTitle}
        description={comparison.metaDescription}
        keywords={comparison.keywords}
        canonicalUrl={`${config.siteUrl}/compare/${comparison.slug}`}
        jsonLd={jsonLd}
      />

      <VStack spacing={10} align="stretch">
        {/* Hero */}
        <Box textAlign="center">
          <Link
            as={RouterLink}
            to="/compare"
            color="blue.500"
            fontWeight="medium"
            fontSize="sm"
            mb={4}
            display="inline-block"
          >
            &larr; All Comparisons
          </Link>
          <Heading as="h1" size="2xl" mt={2} mb={3}>
            {comparison.heroHeadline}
          </Heading>
          <Text fontSize="lg" color="text.secondary" maxW="700px" mx="auto">
            {comparison.heroSubtext}
          </Text>
        </Box>

        {/* Comparison Table */}
        <Box overflowX="auto">
          <Table variant="simple" size="md">
            <Thead>
              <Tr>
                <Th>Feature</Th>
                <Th>Scrum Tools</Th>
                <Th>{comparison.competitorName}</Th>
              </Tr>
            </Thead>
            <Tbody>
              {comparison.features.map((feature) => (
                <Tr key={feature.name}>
                  <Td fontWeight="medium">{feature.name}</Td>
                  <Td>{renderFeatureValue(feature.scrumTools)}</Td>
                  <Td>{renderFeatureValue(feature.competitor)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>

        {/* Prose Sections */}
        {comparison.proseSections.map((section) => (
          <Box key={section.heading}>
            <Heading as="h2" size="lg" mb={3}>
              {section.heading}
            </Heading>
            <Text lineHeight="tall" fontSize="lg" color="text.secondary">
              {section.content}
            </Text>
          </Box>
        ))}

        {/* CTA Sections */}
        <Box>
          <Heading as="h2" size="lg" mb={4} textAlign="center">
            Try Scrum Tools Free
          </Heading>
          <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
            {comparison.ctaSections.map((cta) => (
              <Box
                key={cta.toolPath}
                p={6}
                borderWidth="1px"
                borderRadius="lg"
                bg="bg.surface"
                textAlign="center"
              >
                <Heading as="h3" size="md" mb={2}>
                  {cta.toolName}
                </Heading>
                <Text color="text.secondary" mb={4} fontSize="sm">
                  {cta.description}
                </Text>
                <Button as={RouterLink} to={cta.toolPath} colorScheme="blue" size="sm">
                  Try {cta.toolName}
                </Button>
              </Box>
            ))}
          </SimpleGrid>
        </Box>

        <RelatedTools currentPath="/compare" />
      </VStack>
    </Container>
  );
};

export default ComparisonPage;
