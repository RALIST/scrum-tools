import { FC } from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import PlanningPoker from './pages/PlanningPoker'
import DailyStandup from './pages/DailyStandup'
import './App.css'

const App: FC = () => {
    return (
        <Router>
            <div className="app">
                <Navbar />
                <main className="main-content">
                    <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/planning-poker" element={<PlanningPoker />} />
                        <Route path="/planning-poker/:roomId" element={<PlanningPoker />} />
                        <Route path="/daily-standup" element={<DailyStandup />} />
                    </Routes>
                </main>
            </div>
        </Router>
    )
}

export default App
