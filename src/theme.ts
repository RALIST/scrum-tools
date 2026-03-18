import { extendTheme, type ThemeConfig } from '@chakra-ui/react'

const config: ThemeConfig = {
    initialColorMode: 'light',
    useSystemColorMode: false,
}

const theme = extendTheme({
    config,
    semanticTokens: {
        colors: {
            // Backgrounds
            'bg.page':     { default: 'gray.50',  _dark: 'gray.900' },
            'bg.surface':  { default: 'white',    _dark: 'gray.700' },
            'bg.chrome':   { default: 'white',    _dark: 'gray.800' },
            'bg.subtle':   { default: 'gray.100', _dark: 'gray.600' },
            'bg.inset':    { default: 'gray.100', _dark: 'gray.700' },
            'bg.selected': { default: 'blue.50',  _dark: 'blue.900' },

            // Text
            'text.secondary': { default: 'gray.600', _dark: 'gray.300' },
            'text.muted':     { default: 'gray.500', _dark: 'gray.400' },
            'text.footnote':  { default: 'gray.600', _dark: 'gray.400' },
            'text.subtle':    { default: 'gray.700', _dark: 'gray.300' },

            // Borders
            'border.default': { default: 'gray.200', _dark: 'gray.700' },
            'border.subtle':  { default: 'gray.100', _dark: 'gray.600' },

            // Accent
            'link.accent': { default: 'blue.600', _dark: 'blue.300' },

            // Scrollbar
            'scrollbar.thumb': { default: 'gray.300', _dark: 'gray.600' },
        },
    },
    styles: {
        global: {
            body: {
                bg: 'bg.page',
            },
        },
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
