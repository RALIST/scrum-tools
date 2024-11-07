import { FC, ReactNode } from 'react'
import { Container } from '@chakra-ui/react'

interface PageContainerProps {
    children: ReactNode
}

const PageContainer: FC<PageContainerProps> = ({ children }) => {
    return (
        <Container
            maxW="1200px"
            w="full"
            px={{ base: 4, md: 8 }}
            py={{ base: 6, md: 12 }}
            mx="auto"
        >
            {children}
        </Container>
    )
}

export default PageContainer
