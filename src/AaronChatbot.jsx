import React, { useState, useEffect, useRef } from 'react';
import { Send, X, Minimize2, Maximize2, Shield } from 'lucide-react';
import socket from './socket';
import { useAuth } from './AuthContext';
import { hasPermission, getEffectivePermissions } from './permissions';

// Profanity and abuse filter
const BLOCKED_WORDS = [
  'profanity1', 'profanity2', 'abuse1', 'abuse2', // Add actual blocked words
  // Keep list private and comprehensive
];

const SENSITIVE_PATTERNS = [
  /password/i,
  /credit\s*card/i,
  /ssn|social\s*security/i,
  /api[_\s]*key/i,
  /secret/i,
  /token/i
];

const filterContent = (text) => {
  // Check for profanity
  const lowerText = text.toLowerCase();
  for (const word of BLOCKED_WORDS) {
    if (lowerText.includes(word.toLowerCase())) {
      return { isClean: false, reason: 'profanity' };
    }
  }
  
  // Check for sensitive data
  for (const pattern of SENSITIVE_PATTERNS) {
    if (pattern.test(text)) {
      return { isClean: false, reason: 'sensitive' };
    }
  }
  
  // Check for excessive caps (shouting)
  const capsRatio = (text.match(/[A-Z]/g) || []).length / text.length;
  if (capsRatio > 0.7 && text.length > 10) {
    return { isClean: false, reason: 'shouting' };
  }
  
  return { isClean: true };
};

// Permission-based response system
const getPermissionRestrictedResponse = (message, userPermissions, userRole) => {
  const lower = message.toLowerCase();
  
  // Admin-only requests
  if (lower.includes('delete') || lower.includes('remove user') || lower.includes('permission')) {
    if (!hasPermission(userPermissions, 'manage_permissions')) {
      return "I'm sorry, but that action requires admin permissions. Please contact your administrator for assistance.";
    }
  }
  
  // Manager-only requests
  if (lower.includes('team report') || lower.includes('team performance')) {
    if (!hasPermission(userPermissions, 'view_team_data')) {
      return "You don't have permission to view team data. This feature is available to managers and admins.";
    }
  }
  
  // Analytics requests
  if (lower.includes('analytics') || lower.includes('advanced report')) {
    if (!hasPermission(userPermissions, 'view_analytics')) {
      return "Analytics features require special permissions. Please contact your manager to request access.";
    }
  }
  
  return null; // No restriction, proceed with normal response
};

// AaronChatbot — floating chat panel with Socket.io integration and permission controls
const AaronChatbot = ({ isOpen, onClose }) => {
  const { user, profile, role, hasPermission: checkPermission } = useAuth();
  const [messages, setMessages] = useState([
    {
      id: 1,
      sender: 'aaron',
      text: `Hi${profile?.first_name ? ' ' + profile.first_name : ''}! I'm Aaron, your AI productivity coach. I'm here to help you with tasks within your permission level. How can I help you today?`,
      timestamp: new Date()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isMinimized, setIsMinimized] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [useOfflineMode, setUseOfflineMode] = useState(true);
  const [contentWarning, setContentWarning] = useState('');
  const messagesEndRef = useRef(null);
  const userPermissions = getEffectivePermissions({ 
    role: role || 'power_user', 
    permissionOverrides: {}, 
    explicitPermissions: [] 
  });

  // Socket.io connection management (with fallback to offline mode)
  useEffect(() => {
    if (!isOpen) return;

    // Try to connect to Socket.io server with timeout
    const connectionTimeout = setTimeout(() => {
      if (!isConnected) {
        setUseOfflineMode(true);
        console.log('Socket.io server not available, using offline mode');
      }
    }, 3000);

    socket.on('connect', () => {
      setIsConnected(true);
      setUseOfflineMode(false);
      clearTimeout(connectionTimeout);
      console.log('Connected to Socket.io server');
      
      // Join user-specific room
      if (user?.id) {
        socket.emit('join', { 
          userId: user.id, 
          userName: profile?.first_name || 'User',
          role: role,
          permissions: userPermissions 
        });
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setUseOfflineMode(true);
      console.log('Disconnected from Socket.io server');
    });

    // Listen for incoming messages from Aaron
    socket.on('aaron_message', (data) => {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: Date.now(),
        sender: 'aaron',
        text: data.message,
        timestamp: new Date()
      }]);
    });

    // Listen for typing indicator
    socket.on('aaron_typing', () => {
      setIsTyping(true);
    });

    // Listen for permission errors
    socket.on('permission_denied', (data) => {
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: Date.now(),
        sender: 'aaron',
        text: `⚠️ ${data.message || 'You do not have permission to perform this action.'}`,
        timestamp: new Date()
      }]);
    });

    return () => {
      clearTimeout(connectionTimeout);
      socket.off('connect');
      socket.off('disconnect');
      socket.off('aaron_message');
      socket.off('aaron_typing');
      socket.off('permission_denied');
    };
  }, [isOpen, user, profile, role, userPermissions]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Simulate Aaron's response in offline mode
  const generateOfflineResponse = (message) => {
    const lower = message.toLowerCase();
    
    // Check for permission-based restrictions first
    const restrictedResponse = getPermissionRestrictedResponse(message, userPermissions, role);
    if (restrictedResponse) return restrictedResponse;
    
    // Contextual responses based on keywords
    if (lower.includes('scorecard') || lower.includes('performance')) {
      return "You can view your scorecard performance on the Dashboard page. Would you like help understanding any specific metrics?";
    }
    if (lower.includes('coach') || lower.includes('skill')) {
      return "The Coach page shows your skill development progress. Focus on your lowest-performing skillsets for the biggest impact!";
    }
    if (lower.includes('contest')) {
      return "Check out the Contests page to join competitions and compete with your team. Contests are a great way to boost motivation!";
    }
    if (lower.includes('badge') || lower.includes('achievement')) {
      return "View your badges and achievements in your Profile. Keep hitting your targets to unlock more!";
    }
    if (lower.includes('team') || lower.includes('member')) {
      if (hasPermission(userPermissions, 'view_team_data')) {
        return "As a team leader, you can track your team's performance across all pages. Use filters to focus on specific members.";
      }
      return "Team features are available to managers and admins. Focus on your individual performance to contribute to team success!";
    }
    if (lower.includes('help') || lower.includes('how')) {
      return "I can help you with:\n• Understanding your scorecard metrics\n• Finding areas to improve\n• Navigating the platform\n• Tracking your progress\n\nWhat would you like to know more about?";
    }
    if (lower.includes('thank') || lower.includes('thanks')) {
      return "You're welcome! I'm here to help you succeed. Feel free to ask me anything!";
    }
    
    // Default response
    return "I'm here to help you improve your performance! Ask me about your scorecard, skills, contests, or how to use any feature. What would you like to know?";
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!inputValue.trim()) return;

    // Clear any previous warnings
    setContentWarning('');

    // Filter content for profanity and abuse
    const contentCheck = filterContent(inputValue);
    if (!contentCheck.isClean) {
      let warningMessage = '';
      switch (contentCheck.reason) {
        case 'profanity':
          warningMessage = 'Please keep our conversation professional and respectful.';
          break;
        case 'sensitive':
          warningMessage = 'Please do not share sensitive information like passwords or personal data in chat.';
          break;
        case 'shouting':
          warningMessage = 'Please avoid using excessive capital letters.';
          break;
        default:
          warningMessage = 'Your message contains inappropriate content.';
      }
      setContentWarning(warningMessage);
      setMessages(prev => [...prev, {
        id: Date.now(),
        sender: 'aaron',
        text: `⚠️ ${warningMessage}`,
        timestamp: new Date()
      }]);
      setInputValue('');
      return;
    }

    const userMessage = {
      id: Date.now(),
      sender: 'user',
      text: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    const messageText = inputValue;
    setInputValue('');

    // Send message via Socket.io or use offline mode
    if (isConnected && !useOfflineMode) {
      socket.emit('chat_message', {
        userId: user?.id,
        message: messageText,
        role: role,
        permissions: userPermissions,
        context: {
          page: window.location.pathname,
          userName: profile?.first_name || 'User'
        }
      });
      setIsTyping(true);
    } else {
      // Offline mode - simulate response
      setIsTyping(true);
      setTimeout(() => {
        const response = generateOfflineResponse(messageText);
        setIsTyping(false);
        setMessages(prev => [...prev, {
          id: Date.now() + 1,
          sender: 'aaron',
          text: response,
          timestamp: new Date()
        }]);
      }, 1000 + Math.random() * 1000); // Random delay for realism
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className={`bg-white rounded-lg shadow-2xl overflow-hidden transition-all duration-300 ${
        isMinimized ? 'w-80 h-16' : 'w-80 h-[500px]'
      }`}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white bg-opacity-20 rounded-lg flex items-center justify-center text-white font-bold shadow-md">
              A
            </div>
            <div>
              <div className="font-semibold text-sm">Aaron AI Coach</div>
              <div className="flex items-center gap-2 text-xs text-blue-100">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-yellow-400'}`} />
                {isConnected ? 'Live' : 'Offline Mode'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              aria-label={isMinimized ? 'Maximize' : 'Minimize'}
              className="text-white opacity-90 hover:opacity-100 transition-opacity"
            >
              {isMinimized ? <Maximize2 size={18} /> : <Minimize2 size={18} />}
            </button>
            <button
              onClick={onClose}
              aria-label="Close"
              className="text-white opacity-90 hover:opacity-100 transition-opacity"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Messages Area */}
        {!isMinimized && (
          <>
            <div className="h-[380px] overflow-y-auto p-4 bg-gray-50 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[75%] rounded-lg px-4 py-2 shadow-sm ${
                      msg.sender === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-gray-800 border border-gray-200'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-line">{msg.text}</p>
                    <span className="text-xs opacity-70 mt-1 block">
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white text-gray-800 border border-gray-200 rounded-lg px-4 py-3 shadow-sm">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="px-4 py-3 bg-white border-t border-gray-200">
              {contentWarning && (
                <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                  {contentWarning}
                </div>
              )}
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  aria-label="Ask Aaron for help"
                  placeholder="Ask Aaron for help..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  maxLength={500}
                />
                <button
                  type="submit"
                  disabled={!inputValue.trim()}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Send size={16} />
                </button>
              </form>
              <div className="flex items-center justify-between mt-2">
                <p className="text-xs text-gray-500">
                  {useOfflineMode ? (
                    <span className="flex items-center gap-1">
                      <Shield size={12} /> 
                      Offline mode • Responses limited to your permissions
                    </span>
                  ) : (
                    'Connected to live chat server'
                  )}
                </p>
                <span className="text-xs text-gray-400">{inputValue.length}/500</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AaronChatbot;
