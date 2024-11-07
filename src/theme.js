import { extendTheme } from '@chakra-ui/react'

const config = {
    initialColorMode: 'light',
    useSystemColorMode: false,
}

const theme = extendTheme({
    config,
    styles: {
        global: (props) => ({
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
