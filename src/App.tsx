import { FC } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { ChakraProvider } from '@chakra-ui/react'
import { HelmetProvider } from 'react-helmet-async'
import theme from './theme'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import PlanningPoker from './pages/PlanningPoker'
import PlanningPokerRoom from './pages/PlanningPokerRoom'
import DailyStandup from './pages/DailyStandup'
import RetroLanding from './pages/RetroLanding'
import RetroBoard from './pages/RetroBoard'
import './App.css'

const App: FC = () => {
    return (
        <HelmetProvider>
            <ChakraProvider theme={theme}>
                <div className='app'>
                    <Router>
                        <Navbar />
                        <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/planning-poker" element={<PlanningPoker />} />
                            <Route path="/planning-poker/:roomId" element={<PlanningPokerRoom />} />
                            <Route path="/daily-standup" element={<DailyStandup />} />
                            <Route path="/retro" element={<RetroLanding />} />
                            <Route path="/retro/:boardId" element={<RetroBoard />} />
                        </Routes>
                    </Router>
                </div>

            </ChakraProvider>
        </HelmetProvider>
    )
}

export default App
