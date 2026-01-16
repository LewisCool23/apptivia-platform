import React, { useState } from 'react';
import Navbar from './components/Navbar';
import { 
  Plus, Settings, TrendingUp, Users, Calendar, Phone, Target, Download, Filter, X, Home, Trophy, 
  MessageCircle, Mail, GitBranch, CheckSquare, Menu, User, Gamepad2, Bot, Camera, Save, 
  UserPlus, Trash2, Edit, BarChart3
} from 'lucide-react';

// Custom circular progress component
const CircularProgress = ({ progress, size = 80, strokeWidth = 8, color = '#3B82F6', children }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="relative inline-block">
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={strokeWidth}
          fill="transparent"
          className="text-gray-200"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-300 ease-in-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
};

// Aaron AI Chatbot Component
const AaronChatbot = ({ isOpen, onClose }) => {
  const [messages] = useState([
    { id: 1, sender: 'aaron', text: "Hi! I'm Aaron, your AI productivity coach. How can I help you improve your performance today?" }
  ]);

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-4 right-4 w-80 h-96 bg-white rounded-xl shadow-xl border z-50 flex flex-col">
      <div className="p-4 border-b bg-blue-500 text-white rounded-t-xl flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot size={20} />
          <span className="font-semibold">Aaron AI Coach</span>
        </div>
        <button onClick={onClose} className="text-white hover:bg-blue-600 p-1 rounded">
          <X size={16} />
        </button>
      </div>
      
      <div className="flex-1 p-4 overflow-y-auto">
        {messages.map(message => (
          <div key={message.id} className="bg-gray-100 p-3 rounded-lg text-sm">
            <p>{message.text}</p>
          </div>
        ))}
      </div>
      
      <div className="p-4 border-t">
        <input
          type="text"
          placeholder="Ask Aaron for help..."
          className="w-full px-3 py-2 border rounded-lg text-sm"
        />
      </div>
    </div>
  );
};

const ApptiviaScorecard = () => {
  const [currentPage, setCurrentPage] = useState('home');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [chatbotOpen, setChatbotOpen] = useState(false);
  
  // currentUser state removed; use AuthContext instead

  const navigation = [
    { id: 'home', name: 'Apptivity Scorecard', icon: Home, description: 'Performance dashboard' },
    { id: 'coach', name: 'Apptivity Coach', icon: Trophy, description: 'Skill development' },
    { id: 'contests', name: 'Contests', icon: Gamepad2, description: 'Sales competitions' },
    { id: 'analytics', name: 'Analytics', icon: BarChart3, description: 'Advanced insights' },
    { id: 'systems', name: 'Systems', icon: Settings, description: 'Integrations & admin' },
    { id: 'profile', name: 'Profile', icon: User, description: 'Personal settings' }
  ];

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <Navbar />
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-white shadow-lg transition-all duration-300 flex flex-col`}>
        <div className="p-4 border-b">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="font-bold text-lg text-gray-900">Apptiv</h1>
                <p className="text-xs text-gray-500">Sales Productivity Platform</p>
              </div>
            )}
          </div>
        </div>

        {/* User info in sidebar removed; now handled by Navbar */}

        <nav className="flex-1 p-4">
          <div className="space-y-2">
            {navigation.map(item => (
              <button
                key={item.id}
                onClick={() => setCurrentPage(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  currentPage === item.id 
                    ? 'bg-blue-500 text-white' 
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <item.icon size={20} />
                {sidebarOpen && (
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="text-xs opacity-75">{item.description}</div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </nav>

        <div className="p-4 border-t">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="w-full flex items-center justify-center p-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            <Menu size={20} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        {currentPage === 'home' && <ScorecardPage />}
        {currentPage === 'coach' && <CoachPage />}
        {currentPage === 'contests' && <ContestsPage />}
        {currentPage === 'analytics' && <AnalyticsPage />}
        {currentPage === 'systems' && <SystemsPage />}
        {currentPage === 'profile' && <ProfilePage />}
      </div>

      <AaronChatbot isOpen={chatbotOpen} onClose={() => setChatbotOpen(false)} />
      
      {!chatbotOpen && (
        <button
          onClick={() => setChatbotOpen(true)}
          className="fixed bottom-4 right-4 w-14 h-14 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600 flex items-center justify-center z-40"
        >
          <Bot size={24} />
        </button>
      )}
    </div>
  );
};

// Scorecard Page
const ScorecardPage = ({ currentUser }) => {
  const [kpis] = useState([
    { id: 1, name: 'Call Connects', goal: 100, weight: 30, icon: Phone },
    { id: 2, name: 'Talk Time Minutes', goal: 100, weight: 30, icon: TrendingUp },
    { id: 3, name: 'Meetings', goal: 3, weight: 10, icon: Calendar },
    { id: 4, name: 'Sourced Opps', goal: 4, weight: 15, icon: Target },
    { id: 5, name: 'Stage 2 Opps', goal: 3, weight: 15, icon: Users }
  ]);

  const [teamData] = useState([
    { id: 1, name: 'Sarah Johnson', team: 'Sales Team A', connects: 515, talkTime: 710, meetings: 3, sourcedOpps: 6, stage2Opps: 4.5 },
    { id: 2, name: 'Mike Chen', team: 'Sales Team A', connects: 205, talkTime: 120, meetings: 7.5, sourcedOpps: 5, stage2Opps: 3.33 },
    { id: 3, name: 'Alex Rivera', team: 'Sales Team B', connects: 84, talkTime: 72, meetings: 7.5, sourcedOpps: 3.75, stage2Opps: 4.5 },
    { id: 4, name: 'Jordan Smith', team: 'Sales Team B', connects: 108, talkTime: 108, meetings: 3, sourcedOpps: 5, stage2Opps: 4.5 }
  ]);

  const [filters, setFilters] = useState({
    team: 'All',
    dateRange: 'This Week'
  });

  const [hoveredCell, setHoveredCell] = useState(null);

  const calculateScore = (repData) => {
    const scores = {
      connects: Math.min((repData.connects / kpis[0].goal) * 100, 200),
      talkTime: Math.min((repData.talkTime / kpis[1].goal) * 100, 200),
      meetings: Math.min((repData.meetings / kpis[2].goal) * 100, 200),
      sourcedOpps: Math.min((repData.sourcedOpps / kpis[3].goal) * 100, 200),
      stage2Opps: Math.min((repData.stage2Opps / kpis[4].goal) * 100, 200)
    };

    const weightedScore = 
      (scores.connects * kpis[0].weight / 100) +
      (scores.talkTime * kpis[1].weight / 100) +
      (scores.meetings * kpis[2].weight / 100) +
      (scores.sourcedOpps * kpis[3].weight / 100) +
      (scores.stage2Opps * kpis[4].weight / 100);

    return {
      individual: scores,
      total: Math.round(weightedScore)
    };
  };

  const getScoreColor = (score) => {
    if (score >= 100) return 'text-green-600 bg-green-100';
    if (score >= 80) return 'text-green-500 bg-green-50';
    if (score >= 65) return 'text-yellow-600 bg-yellow-100';
    if (score >= 50) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  const getCoachingSuggestion = (repName, metricName) => {
    const suggestions = {
      'Call Connects': `${repName} could benefit from call timing optimization. Try scheduling calls during peak hours.`,
      'Talk Time Minutes': `${repName} needs to practice active listening and asking open-ended questions.`,
      'Meetings': `${repName} should focus on qualifying prospects better before requesting meetings.`,
      'Sourced Opps': `${repName} needs to improve lead qualification and opportunity identification.`,
      'Stage 2 Opps': `${repName} needs help advancing opportunities through the sales process.`
    };
    return suggestions[metricName] || `${repName} could use coaching in ${metricName.toLowerCase()}.`;
  };

  const filteredTeam = filters.team === 'All' ? teamData : teamData.filter(rep => rep.team === filters.team);
  const sortedTeam = filteredTeam
    .map(rep => ({ ...rep, score: calculateScore(rep) }))
    .sort((a, b) => b.score.total - a.score.total);

  const teams = [...new Set(teamData.map(rep => rep.team))];

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Apptivity Scorecard</h1>
          <p className="text-gray-600 mt-2">Real-time productivity scoring for your sales team</p>
        </div>
        
        <div className="flex gap-3">
          <button className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2">
            <Download size={16} />
            Export
          </button>
          <button className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2">
            <Settings size={16} />
            Configure
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-4 bg-white rounded-lg p-3 shadow-sm border">
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-gray-500" />
          <span className="text-sm font-medium text-gray-700">Filters:</span>
        </div>
        
        <select 
          value={filters.dateRange}
          onChange={(e) => setFilters({...filters, dateRange: e.target.value})}
          className="px-2 py-1 border rounded text-sm"
        >
          <option>Today</option>
          <option>This Week</option>
          <option>This Month</option>
          <option>This Quarter</option>
        </select>
        
        <select 
          value={filters.team}
          onChange={(e) => setFilters({...filters, team: e.target.value})}
          className="px-2 py-1 border rounded text-sm"
        >
          <option>All Teams</option>
          {teams.map(team => <option key={team}>{team}</option>)}
        </select>
      </div>

      <div className="mb-6 grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-sm font-medium text-gray-600">Top Performer</h3>
          <p className="text-2xl font-bold text-green-600 mt-2">
            {sortedTeam[0]?.name || 'N/A'}
          </p>
          <p className="text-sm text-gray-500">{sortedTeam[0]?.score.total || 0}% Score</p>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-sm font-medium text-gray-600">Team Average</h3>
          <p className="text-2xl font-bold text-blue-600 mt-2">
            {sortedTeam.length ? Math.round(sortedTeam.reduce((sum, rep) => sum + rep.score.total, 0) / sortedTeam.length) : 0}%
          </p>
          <p className="text-sm text-gray-500">Apptivity Score</p>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-sm font-medium text-gray-600">Above Target</h3>
          <p className="text-2xl font-bold text-purple-600 mt-2">
            {sortedTeam.filter(rep => rep.score.total >= 100).length}
          </p>
          <p className="text-sm text-gray-500">of {sortedTeam.length} reps</p>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <h3 className="text-sm font-medium text-gray-600">Need Coaching</h3>
          <p className="text-2xl font-bold text-orange-600 mt-2">
            {sortedTeam.filter(rep => rep.score.total < 80).length}
          </p>
          <p className="text-sm text-gray-500">Below 80%</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Team Performance Scorecard</h2>
          <p className="text-gray-600 mt-1">Weekly productivity metrics and Apptivity Scores</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rep Name
                </th>
                {kpis.map(kpi => (
                  <th key={kpi.id} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {kpi.name}
                    <div className="text-xs text-gray-400 mt-1">
                      Goal: {kpi.goal} | {kpi.weight}%
                    </div>
                  </th>
                ))}
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider bg-blue-50">
                  Apptivity Score
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedTeam.map((rep, index) => {
                const scores = rep.score;
                return (
                  <tr key={rep.id} className={index < 3 ? 'bg-green-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {index < 3 && <span className="mr-2 text-yellow-500">🏆</span>}
                        <div>
                          <div className="text-sm font-medium text-gray-900">{rep.name}</div>
                          <div className="text-sm text-gray-500">#{index + 1}</div>
                        </div>
                      </div>
                    </td>
                    
                    <td 
                      className="px-4 py-4 text-center relative"
                      onMouseEnter={() => setHoveredCell({rep: rep.id, metric: 'connects'})}
                      onMouseLeave={() => setHoveredCell(null)}
                    >
                      <div className="text-sm font-medium">{rep.connects}</div>
                      <div className={`text-xs px-2 py-1 rounded ${getScoreColor(scores.individual.connects)}`}>
                        {Math.round(scores.individual.connects)}%
                      </div>
                      
                      {hoveredCell?.rep === rep.id && hoveredCell?.metric === 'connects' && scores.individual.connects < 80 && (
                        <div className="absolute z-10 top-full left-1/2 transform -translate-x-1/2 mt-2 bg-white border shadow-lg rounded-lg p-3 w-64">
                          <div className="flex items-start gap-2">
                            <Bot className="text-blue-500 mt-1" size={16} />
                            <div>
                              <div className="text-xs font-medium text-blue-900">Aaron's Coaching Suggestion</div>
                              <div className="text-xs text-gray-700 mt-1">
                                {getCoachingSuggestion(rep.name, 'Call Connects')}
                              </div>
                              <button className="text-xs text-blue-600 hover:text-blue-800 mt-2 flex items-center gap-1">
                                <Trophy size={12} />
                                Go to Coach →
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </td>
                    
                    <td className="px-4 py-4 text-center">
                      <div className="text-sm font-medium">{rep.talkTime}</div>
                      <div className={`text-xs px-2 py-1 rounded ${getScoreColor(scores.individual.talkTime)}`}>
                        {Math.round(scores.individual.talkTime)}%
                      </div>
                    </td>
                    
                    <td className="px-4 py-4 text-center">
                      <div className="text-sm font-medium">{rep.meetings}</div>
                      <div className={`text-xs px-2 py-1 rounded ${getScoreColor(scores.individual.meetings)}`}>
                        {Math.round(scores.individual.meetings)}%
                      </div>
                    </td>
                    
                    <td className="px-4 py-4 text-center">
                      <div className="text-sm font-medium">{rep.sourcedOpps}</div>
                      <div className={`text-xs px-2 py-1 rounded ${getScoreColor(scores.individual.sourcedOpps)}`}>
                        {Math.round(scores.individual.sourcedOpps)}%
                      </div>
                    </td>
                    
                    <td className="px-4 py-4 text-center">
                      <div className="text-sm font-medium">{rep.stage2Opps}</div>
                      <div className={`text-xs px-2 py-1 rounded ${getScoreColor(scores.individual.stage2Opps)}`}>
                        {Math.round(scores.individual.stage2Opps)}%
                      </div>
                    </td>
                    
                    <td className="px-6 py-4 text-center bg-blue-50">
                      <div className={`text-lg font-bold px-3 py-2 rounded-lg ${getScoreColor(scores.total)}`}>
                        {scores.total}%
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Coach Page
const CoachPage = ({ currentUser }) => {
  const [filters, setFilters] = useState({
    rep: 'All',
    team: 'All'
  });

  const isManager = currentUser.role === 'Manager' || currentUser.role === 'Admin';

  return (
    <div className="p-6">
      <div className="mb-6 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Trophy className="text-yellow-500" size={28} />
            <h1 className="text-2xl font-bold text-gray-900">Apptivity Coach</h1>
          </div>
          <p className="text-gray-600">Level up your sales skills and unlock your potential</p>
        </div>

        {isManager && (
          <div className="flex gap-3">
            <select 
              value={filters.team}
              onChange={(e) => setFilters({...filters, team: e.target.value})}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="All">All Teams</option>
              <option value="Sales Team A">Sales Team A</option>
              <option value="Sales Team B">Sales Team B</option>
            </select>
            
            <select 
              value={filters.rep}
              onChange={(e) => setFilters({...filters, rep: e.target.value})}
              className="px-3 py-2 border rounded-lg text-sm"
            >
              <option value="All">All Reps</option>
              <option value="Sarah Johnson">Sarah Johnson</option>
              <option value="Mike Chen">Mike Chen</option>
            </select>
          </div>
        )}
      </div>

      <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl p-6 mb-6 text-white">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
              <Target size={24} />
              <h2 className="text-2xl font-bold">Intermediate</h2>
            </div>
            <p className="text-blue-100">Current Apptivity Level</p>
            <div className="mt-2">
              <span className="text-3xl font-bold">87%</span>
              <span className="text-blue-100 ml-2">Overall Score</span>
            </div>
          </div>

          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-3">
              <CircularProgress progress={75} size={96} color="white">
                <span className="text-white font-bold text-lg">75%</span>
              </CircularProgress>
            </div>
            <p className="text-blue-100">Progress to Proficient</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold">3</div>
              <div className="text-blue-100 text-sm">Day Streak</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">4</div>
              <div className="text-blue-100 text-sm">Achievements</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">12</div>
              <div className="text-blue-100 text-sm">Milestones</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold">875</div>
              <div className="text-blue-100 text-sm">Points</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm">
        <h2 className="text-xl font-semibold mb-6">Skillset Mastery Progress</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[
            { 
              name: 'Conversationalist', 
              progress: 75, 
              level: 7.5,
              color: '#3B82F6',
              bgColor: 'bg-blue-50',
              borderColor: 'border-blue-200',
              icon: MessageCircle,
              description: 'Master meaningful sales conversations',
              nextGoal: 'Improve talk ratio to 80%'
            },
            { 
              name: 'Call Conqueror', 
              progress: 68, 
              level: 6.8,
              color: '#10B981',
              bgColor: 'bg-green-50',
              borderColor: 'border-green-200',
              icon: Phone,
              description: 'Excel at call conversion',
              nextGoal: 'Book 10 meetings this week'
            },
            { 
              name: 'Email Warrior', 
              progress: 82, 
              level: 8.2,
              color: '#8B5CF6',
              bgColor: 'bg-purple-50',
              borderColor: 'border-purple-200',
              icon: Mail,
              description: 'Dominate email outreach',
              nextGoal: 'Maintain 25%+ reply rate'
            },
            { 
              name: 'Pipeline Guru', 
              progress: 59, 
              level: 5.9,
              color: '#F59E0B',
              bgColor: 'bg-orange-50',
              borderColor: 'border-orange-200',
              icon: GitBranch,
              description: 'Generate high-value opportunities',
              nextGoal: 'Create $50K pipeline this month'
            },
            { 
              name: 'Task Master', 
              progress: 91, 
              level: 9.1,
              color: '#EF4444',
              bgColor: 'bg-red-50',
              borderColor: 'border-red-200',
              icon: CheckSquare,
              description: 'Perfect task execution',
              nextGoal: '100% completion for 10 days'
            }
          ].map((skillset, index) => {
            const Icon = skillset.icon;
            return (
              <div key={index} className={`${skillset.bgColor} ${skillset.borderColor} border-2 rounded-xl p-6 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 rounded-lg bg-white shadow-sm">
                      <Icon style={{ color: skillset.color }} size={24} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg text-gray-900">{skillset.name}</h3>
                      <p className="text-sm text-gray-600">{skillset.description}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-center mb-4">
                  <CircularProgress progress={skillset.progress} size={100} color={skillset.color} strokeWidth={8}>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-gray-900">{skillset.level}</div>
                      <div className="text-xs text-gray-500">/ 10</div>
                    </div>
                  </CircularProgress>
                </div>

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-700">Progress</span>
                    <span className="text-sm font-bold" style={{ color: skillset.color }}>{skillset.progress}%</span>
                  </div>
                  
                  <div className="w-full bg-white rounded-full h-2 shadow-inner">
                    <div 
                      className="h-2 rounded-full transition-all duration-500 ease-out"
                      style={{ 
                        width: `${skillset.progress}%`,
                        backgroundColor: skillset.color
                      }}
                    ></div>
                  </div>

                  <div className="bg-white rounded-lg p-3 border border-gray-100">
                    <div className="text-xs font-medium text-gray-600 mb-1">Next Milestone</div>
                    <div className="text-sm text-gray-900">{skillset.nextGoal}</div>
                  </div>

                  <button 
                    className="w-full py-2 px-4 rounded-lg font-medium text-sm transition-colors hover:opacity-90"
                    style={{ 
                      backgroundColor: skillset.color,
                      color: 'white'
                    }}
                  >
                    View Details
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Simplified other pages to avoid errors
const ContestsPage = ({ currentUser }) => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Sales Contests</h1>
      <p className="text-gray-600 mb-6">Gamify performance and drive results</p>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-semibold text-lg">Call Volume Challenge</h3>
            <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Active</span>
          </div>
          <p className="text-gray-600 text-sm mb-4">Most calls this week wins $100 gift card</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Participants:</span>
              <span>12</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Leader:</span>
              <span className="font-medium">Sarah Johnson</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Prize:</span>
              <span className="text-green-600 font-medium">$100 Gift Card</span>
            </div>
          </div>
          <button className="w-full mt-4 bg-blue-50 text-blue-600 py-2 rounded-lg hover:bg-blue-100">
            View Leaderboard
          </button>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-semibold text-lg">Pipeline Generation</h3>
            <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">Upcoming</span>
          </div>
          <p className="text-gray-600 text-sm mb-4">Highest pipeline value this month</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Participants:</span>
              <span>8</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Starts:</span>
              <span>Sept 9</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Prize:</span>
              <span className="text-green-600 font-medium">Team Lunch</span>
            </div>
          </div>
          <button className="w-full mt-4 bg-gray-50 text-gray-600 py-2 rounded-lg">
            Coming Soon
          </button>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex justify-between items-start mb-4">
            <h3 className="font-semibold text-lg">Meeting Master</h3>
            <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">Completed</span>
          </div>
          <p className="text-gray-600 text-sm mb-4">Most meetings booked last quarter</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Winner:</span>
              <span className="font-medium">Mike Chen</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Score:</span>
              <span>47 meetings</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Prize:</span>
              <span className="text-green-600 font-medium">$500 Bonus</span>
            </div>
          </div>
          <button className="w-full mt-4 bg-yellow-50 text-yellow-600 py-2 rounded-lg">
            View Results
          </button>
        </div>
      </div>
    </div>
  );
};

const AnalyticsPage = ({ currentUser }) => {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Analytics Dashboard</h1>
      <p className="text-gray-600 mb-6">Advanced reporting and insights</p>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-600">Total Calls</h3>
              <p className="text-2xl font-bold text-blue-600">1,247</p>
              <p className="text-sm text-green-600">+12% vs last month</p>
            </div>
            <Phone className="text-blue-600" size={24} />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-600">Meetings</h3>
              <p className="text-2xl font-bold text-green-600">89</p>
              <p className="text-sm text-green-600">+8% vs last month</p>
            </div>
            <Calendar className="text-green-600" size={24} />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-600">Pipeline</h3>
              <p className="text-2xl font-bold text-purple-600">$284K</p>
              <p className="text-sm text-green-600">+15% vs last month</p>
            </div>
            <Target className="text-purple-600" size={24} />
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-600">Team Score</h3>
              <p className="text-2xl font-bold text-orange-600">88%</p>
              <p className="text-sm text-green-600">+5% vs last month</p>
            </div>
            <TrendingUp className="text-orange-600" size={24} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h2 className="text-xl font-semibold mb-4">Performance Trends</h2>
          <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
            <span className="text-gray-500">Chart visualization</span>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <h2 className="text-xl font-semibold mb-4">Top Performers</h2>
          <div className="space-y-3">
            {['Sarah Johnson', 'Mike Chen', 'Alex Rivera', 'Jordan Smith'].map((name, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                    index === 0 ? 'bg-yellow-500 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {index + 1}
                  </div>
                  <span className="font-medium">{name}</span>
                </div>
                <span className="font-bold">{96 - index * 3}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const SystemsPage = ({ currentUser }) => {
  const [activeTab, setActiveTab] = useState('integrations');
  
  const integrations = [
    { name: 'Salesforce', connected: true, icon: '☁️', status: 'Active' },
    { name: 'Outreach.io', connected: true, icon: '📧', status: 'Active' },
    { name: 'Salesloft', connected: false, icon: '📊', status: 'Not Connected' },
    { name: 'Gong.io', connected: true, icon: '🎙️', status: 'Active' },
    { name: 'Microsoft Outlook', connected: false, icon: '📅', status: 'Not Connected' },
    { name: 'HubSpot', connected: false, icon: '🧡', status: 'Available' }
  ];

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Systems Management</h1>
      <p className="text-gray-600 mb-6">Manage integrations and system settings</p>

      <div className="flex space-x-1 bg-white rounded-lg p-1 mb-6 shadow-sm">
        <button
          onClick={() => setActiveTab('integrations')}
          className={`px-4 py-2 rounded-md transition-colors flex-1 text-center ${
            activeTab === 'integrations' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          Integrations
        </button>
        <button
          onClick={() => setActiveTab('teams')}
          className={`px-4 py-2 rounded-md transition-colors flex-1 text-center ${
            activeTab === 'teams' ? 'bg-blue-500 text-white' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          Teams
        </button>
      </div>

      {activeTab === 'integrations' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {integrations.map((integration, index) => (
            <div key={index} className="bg-white rounded-xl p-6 shadow-sm border">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{integration.icon}</span>
                  <div>
                    <h3 className="font-semibold">{integration.name}</h3>
                    <p className="text-sm text-gray-500">Sales integration</p>
                  </div>
                </div>
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  integration.connected 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {integration.status}
                </span>
              </div>
              
              <button className={`w-full py-2 px-4 rounded-lg font-medium ${
                integration.connected
                  ? 'bg-red-500 text-white hover:bg-red-600'
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}>
                {integration.connected ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'teams' && (
        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-xl font-semibold">Sales Team A</h3>
            <button className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center gap-2">
              <UserPlus size={16} />
              Add Member
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              { name: 'Sarah Johnson', role: 'Manager', email: 'sarah.j@company.com' },
              { name: 'Mike Chen', role: 'AE', email: 'mike.c@company.com' },
              { name: 'Alex Rivera', role: 'SDR', email: 'alex.r@company.com' }
            ].map((member, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-semibold">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div>
                    <div className="font-medium text-sm">{member.name}</div>
                    <div className="text-xs text-gray-500">{member.email}</div>
                    <span className={`inline-block px-2 py-1 text-xs rounded-full mt-1 ${
                      member.role === 'Manager' ? 'bg-purple-100 text-purple-800' :
                      member.role === 'AE' ? 'bg-green-100 text-green-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {member.role}
                    </span>
                  </div>
                </div>
                <button className="text-red-500 hover:text-red-600 p-1">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ProfilePage = ({ currentUser }) => {
  const [profile, setProfile] = useState({
    name: currentUser.name,
    phone: currentUser.phone,
    timezone: 'EST'
  });

  const [isEditing, setIsEditing] = useState(false);

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Profile Settings</h1>
        <p className="text-gray-600">Manage your personal information</p>
      </div>

      <div className="max-w-2xl">
        <div className="bg-white rounded-xl p-6 shadow-sm border mb-6">
          <h2 className="text-lg font-semibold mb-4">Profile Photo</h2>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-xl">
                {profile.name.split(' ').map(n => n[0]).join('')}
              </span>
            </div>
            <div>
              <button className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center gap-2">
                <Camera size={16} />
                Upload Photo
              </button>
              <p className="text-xs text-gray-500 mt-1">JPG, PNG up to 5MB</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Personal Information</h2>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className="text-blue-500 hover:text-blue-600 flex items-center gap-1"
            >
              <Edit size={16} />
              {isEditing ? 'Cancel' : 'Edit'}
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
              {isEditing ? (
                <input
                  type="text"
                  value={profile.name}
                  onChange={(e) => setProfile({...profile, name: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              ) : (
                <p className="text-gray-900">{profile.name}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              {isEditing ? (
                <input
                  type="tel"
                  value={profile.phone}
                  onChange={(e) => setProfile({...profile, phone: e.target.value})}
                  className="w-full px-3 py-2 border rounded-lg"
                />
              ) : (
                <p className="text-gray-900">{profile.phone}</p>
              )}
            </div>

            {isEditing && (
              <div className="flex gap-2 pt-4">
                <button
                  onClick={() => setIsEditing(false)}
                  className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center gap-2"
                >
                  <Save size={16} />
                  Save Changes
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApptiviaScorecard;