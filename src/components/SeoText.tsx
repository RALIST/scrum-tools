import { CheckCircleIcon } from '@chakra-ui/icons'
import {
    Box,
    Container,
    Heading,
    Text,
    List,
    ListItem,
    ListIcon,
    Stack
} from '@chakra-ui/react'
import type { FC } from 'react'

interface SeoSection {
    title: string
    description: string
    items: string[]
}

interface SeoTextProps {
    sections: SeoSection[]
}

const SeoText: FC<SeoTextProps> = ({ sections }) => {
    return (
        <Container maxW="container.lg">
            <Stack spacing={12}>
                {sections.map((section) => (
                    <Box key={section.title}>
                        <Heading as="h2" size="lg" mb={6}>
                            {section.title}
                        </Heading>
                        <Text fontSize="lg" mb={4}>
                            {section.description}
                        </Text>
                        <List spacing={3}>
                            {section.items.map((item) => (
                                <ListItem key={item}>
                                    <ListIcon as={CheckCircleIcon} color="green.500" />
                                    {item}
                                </ListItem>
                            ))}
                        </List>
                    </Box>
                ))}
            </Stack>
        </Container>
    )
}

export default SeoText
