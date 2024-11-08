import { FC } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import PlanningPoker from './pages/PlanningPoker'
import PlanningPokerRoom from './pages/PlanningPokerRoom'
import DailyStandup from './pages/DailyStandup'
import './App.css'

const App: FC = () => {
    return (
        <HelmetProvider>
            <Router>
                <div className="app">
                    <Navbar />
                    <main className="main-content">
                        <Routes>
                            <Route path="/" element={<Home />} />
                            <Route path="/planning-poker" element={<PlanningPoker />} />
                            <Route path="/planning-poker/:roomId" element={<PlanningPokerRoom />} />
                            <Route path="/daily-standup" element={<DailyStandup />} />
                        </Routes>
                    </main>
                </div>
            </Router>
        </HelmetProvider>
    )
}

export default App
