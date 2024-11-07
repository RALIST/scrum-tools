import { extendTheme, ThemeConfig } from '@chakra-ui/react'

const config: ThemeConfig = {
    initialColorMode: 'light',
    useSystemColorMode: false,
}

const theme = extendTheme({
    config,
    styles: {
        global: (props: { colorMode: string }) => ({
            body: {
                bg: props.colorMode === 'light' ? 'gray.50' : 'gray.900',
            },
        }),
    },
    components: {
        Button: {
            defaultProps: {
                colorScheme: 'blue',
            },
        },
    },
})

export default theme
