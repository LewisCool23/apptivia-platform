# Apptivia Platform

A modern sales productivity platform built with React, Tailwind CSS, Supabase, and Socket.io.

## Features
- **Apptivia Scorecard**: Performance tracking and KPI monitoring
- **Apptivia Coach**: Skill development and coaching insights
- **Contests**: Sales competitions and leaderboards
- **Analytics**: Advanced reporting and insights
- **Real-time Updates**: Live data via Socket.io
- **Badge & Achievement System**: Gamification and recognition

## Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- Socket.io server (for real-time features)

### Installation

1. Clone the repository
2. Copy `.env.example` to `.env` and configure:
   ```bash
   REACT_APP_SUPABASE_URL=your-supabase-url
   REACT_APP_SUPABASE_ANON_KEY=your-supabase-anon-key
   REACT_APP_SOCKET_IO_URL=your-socket-server-url
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start development server:
   ```bash
   npm start
   ```
5. Build for production:
   ```bash
   npm run build
   ```

## Project Structure
```
src/
  ├── components/     # Reusable UI components
  ├── pages/          # Page components
  ├── hooks/          # Custom React hooks
  ├── contexts/       # React contexts
  ├── utils/          # Utility functions
  └── App.jsx         # Main app component
```

## Deployment
Deploy the contents of the `build/` folder to your hosting provider.
