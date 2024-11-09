import { FC, ReactNode } from 'react'
import { Container } from '@chakra-ui/react'

interface PageContainerProps {
    children: ReactNode
}

const PageContainer: FC<PageContainerProps> = ({ children }) => {
    return (
        <Container
            maxW="container.xl"
            flex="1"
            minH="calc(100vh - 120px)"
            display="flex"
            flexDirection="column"
            px={{ base: 4, md: 6 }}
            py={4}
        >
            {children}
        </Container>
    )
}

export default PageContainer
