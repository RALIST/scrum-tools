import { Box, Heading, SimpleGrid, Text, LinkBox, LinkOverlay } from '@chakra-ui/react';
import type { FC } from 'react';
import { Link as RouterLink } from 'react-router-dom';

interface Tool {
  name: string;
  path: string;
  description: string;
}

const allTools: Tool[] = [
  {
    name: 'Planning Poker',
    path: '/planning-poker',
    description: 'Estimate story points with your team in real-time using our free online Planning Poker tool.',
  },
  {
    name: 'Retro Board',
    path: '/retro',
    description: 'Run effective sprint retrospectives with real-time collaboration, voting, and action item tracking.',
  },
  {
    name: 'Daily Standup Timer',
    path: '/daily-standup',
    description: 'Keep your daily standup meetings focused and on time with individual member timers.',
  },
  {
    name: 'Team Velocity Tracker',
    path: '/velocity',
    description: 'Track and visualize your team\'s sprint velocity to improve planning accuracy.',
  },
];

interface RelatedToolsProps {
  currentPath: string;
}

const RelatedTools: FC<RelatedToolsProps> = ({ currentPath }) => {
  const relatedTools = allTools.filter(tool => tool.path !== currentPath);

  return (
    <Box as="nav" aria-label="Related tools" py={8}>
      <Heading as="h2" size="lg" mb={6} textAlign="center">
        Explore More Scrum Tools
      </Heading>
      <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
        {relatedTools.map(tool => (
          <LinkBox
            key={tool.path}
            p={5}
            borderWidth="1px"
            borderRadius="md"
            bg="bg.surface"
            _hover={{ shadow: 'md', transform: 'translateY(-2px)' }}
            transition="all 0.2s"
          >
            <Heading as="h3" size="md" mb={2}>
              <LinkOverlay as={RouterLink} to={tool.path}>
                {tool.name}
              </LinkOverlay>
            </Heading>
            <Text fontSize="sm" color="text.secondary">
              {tool.description}
            </Text>
          </LinkBox>
        ))}
      </SimpleGrid>
    </Box>
  );
};

export default RelatedTools;
