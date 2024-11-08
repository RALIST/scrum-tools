interface Config {
    apiUrl: string
    socketUrl: string
    siteUrl: string
}

const isDev = import.meta.env.DEV

const config: Config = {
    apiUrl: isDev ? 'http://localhost:3001/api' : 'https://scrumtools.app/api',
    socketUrl: isDev ? 'http://localhost:3001' : 'https://scrumtools.app',
    siteUrl: isDev ? 'http://localhost:5173' : 'https://scrumtools.app'
}

export default config
