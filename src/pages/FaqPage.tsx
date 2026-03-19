import {
  Accordion,
  AccordionButton,
  AccordionIcon,
  AccordionItem,
  AccordionPanel,
  Box,
  Container,
  Heading,
  Text,
  VStack,
} from '@chakra-ui/react';
import type { FC } from 'react';
import PageHelmet from '../components/PageHelmet';
import RelatedTools from '../components/RelatedTools';
import config from '../config';
import { faqCategories } from '../content/faqData';

const FaqPage: FC = () => {
  const allQuestions = faqCategories.flatMap((cat) => cat.items);

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: allQuestions.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: {
          '@type': 'Answer',
          text: item.answer,
        },
      })),
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
          name: 'FAQ',
          item: `${config.siteUrl}/faq`,
        },
      ],
    },
  ];

  return (
    <Container maxW="container.lg" py={8}>
      <PageHelmet
        title="FAQ - Scrum Tools | Frequently Asked Questions"
        description="Find answers to common questions about Scrum Tools. Learn about our free Planning Poker, Retro Board, Daily Standup Timer, and Velocity Tracker."
        keywords="scrum tools faq, planning poker questions, retro board help, agile tools faq, free scrum tools"
        canonicalUrl={`${config.siteUrl}/faq`}
        jsonLd={jsonLd}
      />

      <VStack spacing={8} align="stretch">
        <Box textAlign="center">
          <Heading as="h1" size="2xl" mb={3}>
            Frequently Asked Questions
          </Heading>
          <Text fontSize="xl" color="text.secondary" maxW="600px" mx="auto">
            Everything you need to know about Scrum Tools
          </Text>
        </Box>

        {faqCategories.map((category) => (
          <Box key={category.name}>
            <Heading as="h2" size="lg" mb={4}>
              {category.name}
            </Heading>
            <Accordion allowMultiple>
              {category.items.map((item) => (
                <AccordionItem key={item.question} borderColor="border.default">
                  <h3>
                    <AccordionButton py={4}>
                      <Box flex="1" textAlign="left" fontWeight="medium" fontSize="lg">
                        {item.question}
                      </Box>
                      <AccordionIcon />
                    </AccordionButton>
                  </h3>
                  <AccordionPanel pb={4}>
                    <Text lineHeight="tall" color="text.secondary">
                      {item.answer}
                    </Text>
                  </AccordionPanel>
                </AccordionItem>
              ))}
            </Accordion>
          </Box>
        ))}

        <RelatedTools currentPath="/faq" />
      </VStack>
    </Container>
  );
};

export default FaqPage;
