# Scrum Tools

A comprehensive suite of free online tools for Agile/Scrum teams. Built with React, Node.js, and PostgreSQL.

## Features

### Planning Poker 🎯
- Real-time voting system for story points estimation
- Room-based collaboration with team members
- Configurable voting sequences (Fibonacci, T-Shirt sizes)
- Instant result visualization
- Password protection for rooms

### Retrospective Board 📝
- Digital board for sprint retrospectives
- Three-column format (What went well, What needs improvement, Action items)
- Real-time collaboration with team members
- Card voting system
- Timer for time-boxed discussions
- Password-protected boards
- Configurable card visibility

### Daily Standup Timer ⏱️
- Configurable timer for each team member
- Visual and audio notifications
- Easy team member management
- Total meeting duration tracking
- Mobile-friendly interface

### Team Velocity Tracker 📈
- Sprint velocity tracking and visualization
- Team-based data management
- Committed vs. Completed points tracking
- Average velocity statistics
- Completion rate analysis
- Password-protected team data
- Interactive velocity chart

## Tech Stack

### Frontend
- React with TypeScript
- Chakra UI for components
- Chart.js for data visualization
- Socket.io client for real-time features
- React Router for navigation
- Dark/Light theme support

### Backend
- Node.js with Express
- PostgreSQL database
- Socket.io for real-time communication
- RESTful API architecture
- JWT for authentication

## Getting Started

### Prerequisites
- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### Installation

1. Clone the repository:
\`\`\`bash
git clone https://github.com/yourusername/scrum-tools.git
cd scrum-tools
\`\`\`

2. Install dependencies for both frontend and backend:
\`\`\`bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install
\`\`\`

3. Set up the database:
\`\`\`bash
# Create a PostgreSQL database
createdb scrum_tools

# Run the schema setup script
cd server
node db/schema.js
\`\`\`

4. Configure environment variables:
\`\`\`bash
# In the server directory, create .env file
cp .env.example .env

# Update the .env file with your database credentials
\`\`\`

5. Start the development servers:
\`\`\`bash
# Start the backend server
npm run server

# In a new terminal, start the frontend (from project root)
npm run dev
\`\`\`

The application will be available at http://localhost:5173

## Usage

### Planning Poker
1. Create a new room or join existing
2. Share room ID with team members
3. Select voting sequence
4. Vote on stories in real-time
5. Reveal votes and discuss

### Retrospective Board
1. Create a new board with password
2. Share board ID with team
3. Add cards to appropriate columns
4. Vote on important items
5. Use timer for focused discussions
6. Track action items

### Daily Standup Timer
1. Add team members
2. Set time limit per person
3. Start the timer
4. Get notifications when time is up
5. Track total meeting duration

### Team Velocity Tracker
1. Create a team with password
2. Add sprint data (committed/completed points)
3. View velocity trends
4. Analyze team performance
5. Track completion rates

## Contributing

1. Fork the repository
2. Create your feature branch (\`git checkout -b feature/AmazingFeature\`)
3. Commit your changes (\`git commit -m 'Add some AmazingFeature'\`)
4. Push to the branch (\`git push origin feature/AmazingFeature\`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Chakra UI](https://chakra-ui.com/) for the component library
- [Socket.io](https://socket.io/) for real-time functionality
- [Chart.js](https://www.chartjs.org/) for data visualization
- All contributors who have helped improve this project
