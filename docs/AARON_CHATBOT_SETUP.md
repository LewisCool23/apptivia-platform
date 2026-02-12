# Aaron Chatbot - Setup & Security Guide

## Overview
Aaron is an AI-powered coaching chatbot with built-in security features:
- ✅ Permission-based access control
- ✅ Profanity and abuse filtering
- ✅ Sensitive data protection
- ✅ Rate limiting
- ✅ Offline mode fallback

## Features

### 1. **Offline Mode** (Active by Default)
Aaron works immediately without a backend server:
- Provides contextual help based on current page
- Respects user permissions
- Filters inappropriate content
- Perfect for development and testing

### 2. **Live Mode** (With Socket.io Server)
Connect to your AI backend for advanced features:
- Real-time AI responses
- Persistent conversation history
- Advanced natural language understanding
- Integration with external AI services

## Security Features

### Permission-Based Access Control
Aaron automatically restricts responses based on user role:

| Request Type | Required Permission | Roles |
|--------------|-------------------|-------|
| Team reports | `view_team_data` | Manager, Admin |
| Analytics | `view_analytics` | Coach, Manager, Admin |
| User management | `manage_permissions` | Admin only |
| Contest creation | `create_contests` | Manager, Admin |

### Content Filtering
Automatically blocks and warns users for:
- ✅ Profanity and offensive language
- ✅ Sensitive data (passwords, credit cards, SSN)
- ✅ Excessive shouting (ALL CAPS)
- ✅ Abusive requests
- ✅ Attempts to share secrets/API keys

### Input Validation
- Maximum message length: 500 characters
- Real-time character counter
- XSS protection through React
- Sanitized before sending to backend

## Socket.io Server Setup (Optional)

### Prerequisites
```bash
npm install socket.io express cors dotenv
```

### Basic Server Implementation

Create `server/aaron-server.js`:

```javascript
const express = require('express');
const { Server } = require('socket.io');
const http = require('http');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Rate limiting per user
const rateLimits = new Map();
const RATE_LIMIT = 10; // messages per minute
const RATE_WINDOW = 60000; // 1 minute

function checkRateLimit(userId) {
  const now = Date.now();
  const userLimits = rateLimits.get(userId) || { count: 0, resetTime: now + RATE_WINDOW };
  
  if (now > userLimits.resetTime) {
    rateLimits.set(userId, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }
  
  if (userLimits.count >= RATE_LIMIT) {
    return false;
  }
  
  userLimits.count++;
  rateLimits.set(userId, userLimits);
  return true;
}

// Permission verification
function verifyPermission(permissions, requiredPermission) {
  return Array.isArray(permissions) && permissions.includes(requiredPermission);
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  socket.on('join', (data) => {
    const { userId, userName, role, permissions } = data;
    socket.join(`user_${userId}`);
    socket.userId = userId;
    socket.userName = userName;
    socket.role = role;
    socket.permissions = permissions;
    
    console.log(`${userName} (${role}) joined chat`);
  });
  
  socket.on('chat_message', async (data) => {
    const { userId, message, role, permissions, context } = data;
    
    // Rate limiting
    if (!checkRateLimit(userId)) {
      socket.emit('aaron_message', {
        message: "⚠️ You're sending messages too quickly. Please wait a moment before trying again."
      });
      return;
    }
    
    // Send typing indicator
    io.to(`user_${userId}`).emit('aaron_typing');
    
    // Process message with permission checks
    try {
      const response = await processMessage(message, role, permissions, context);
      
      // Simulate thinking time
      setTimeout(() => {
        io.to(`user_${userId}`).emit('aaron_message', {
          message: response
        });
      }, 1000 + Math.random() * 1500);
      
    } catch (error) {
      console.error('Error processing message:', error);
      socket.emit('aaron_message', {
        message: "I apologize, but I encountered an error. Please try again."
      });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

async function processMessage(message, role, permissions, context) {
  const lower = message.toLowerCase();
  
  // Permission-based responses
  if (lower.includes('team') && !verifyPermission(permissions, 'view_team_data')) {
    return "You don't have permission to view team data. This feature is available to managers and admins.";
  }
  
  if (lower.includes('analytics') && !verifyPermission(permissions, 'view_analytics')) {
    return "Analytics features require special permissions. Please contact your manager to request access.";
  }
  
  // TODO: Integrate with your AI service (OpenAI, Claude, etc.)
  // For now, return contextual responses
  
  if (lower.includes('scorecard')) {
    return "Your scorecard shows your performance across key metrics. Focus on metrics with the lowest completion percentage for maximum impact. Need help with a specific metric?";
  }
  
  if (lower.includes('improve') || lower.includes('better')) {
    return "Great question! I recommend: 1) Review your lowest-scoring skillsets in the Coach page, 2) Set specific daily targets, 3) Join relevant contests for motivation. What area would you like to focus on?";
  }
  
  return "I'm here to help you succeed! Ask me about your scorecard, skills to improve, or how to use any platform feature.";
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Aaron AI server running on port ${PORT}`);
});
```

### Environment Variables

Create `.env` in server directory:
```
PORT=3001
CLIENT_URL=http://localhost:3000
OPENAI_API_KEY=your_api_key_here (optional)
```

### Start Server
```bash
node server/aaron-server.js
```

### Update Client .env
```
REACT_APP_SOCKET_IO_URL=http://localhost:3001
```

## AI Integration (Advanced)

### With OpenAI
```javascript
const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

async function getAIResponse(message, role, permissions) {
  const systemPrompt = `You are Aaron, a sales productivity coach for Apptivia Platform. 
  User role: ${role}
  User permissions: ${permissions.join(', ')}
  
  Only help with tasks the user has permission for. Be helpful, encouraging, and concise.`;
  
  const completion = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: message }
    ],
    max_tokens: 200,
    temperature: 0.7,
  });
  
  return completion.data.choices[0].message.content;
}
```

## Testing

### Test Offline Mode
1. Open AaronChatbot
2. Status should show "Offline Mode"
3. Send messages - should receive contextual responses
4. Try restricted requests based on role

### Test Permission Controls
```javascript
// As Power User - should be blocked:
"Show me team analytics"
"Delete user account"

// As Manager - should work:
"Show team performance"
"How is my team doing?"

// As Admin - all should work
```

### Test Content Filtering
```javascript
// Should be blocked:
"[profanity]"
"HERE IS MY PASSWORD: 12345"
"GIVE ME ACCESS NOW!!!"

// Should work:
"How can I improve my scorecard?"
"What are my best skills?"
```

## Customization

### Add Custom Blocked Words
Edit `BLOCKED_WORDS` array in [AaronChatbot.jsx](../src/AaronChatbot.jsx):
```javascript
const BLOCKED_WORDS = [
  'word1', 'word2', 'word3'
  // Add your organization's specific terms
];
```

### Add Custom Responses
Edit `generateOfflineResponse` function:
```javascript
if (lower.includes('custom_topic')) {
  return "Your custom response here";
}
```

### Adjust Rate Limiting
In server code:
```javascript
const RATE_LIMIT = 10; // messages per minute
const RATE_WINDOW = 60000; // 1 minute
```

## Monitoring & Logs

### Client-Side Logging
Check browser console for:
- Connection status
- Message sending
- Permission checks
- Content filtering

### Server-Side Logging
Check server logs for:
- User connections
- Rate limit violations
- Permission denials
- Error messages

## Troubleshooting

### Input is Disabled
✅ **Fixed!** Input now works in offline mode by default.

### Messages Not Sending
- Check browser console for errors
- Verify Socket.io server is running
- Check REACT_APP_SOCKET_IO_URL in .env

### Wrong Permissions
- Verify user role in AuthContext
- Check permission overrides
- Test with different user roles

### AI Responses Too Slow
- Adjust typing delay in code
- Optimize AI API calls
- Consider caching common responses

## Production Deployment

### Security Checklist
- [ ] Enable HTTPS for Socket.io server
- [ ] Set up proper CORS restrictions
- [ ] Implement authentication tokens
- [ ] Add request logging
- [ ] Set up error monitoring (Sentry)
- [ ] Configure rate limiting per organization
- [ ] Review and update blocked words list
- [ ] Test all permission levels
- [ ] Enable SSL certificate validation

### Performance Optimization
- [ ] Use Redis for rate limiting
- [ ] Cache common AI responses
- [ ] Implement message queuing
- [ ] Set up CDN for static assets
- [ ] Monitor server resource usage

## Best Practices

1. **Regular Updates**: Keep blocked words list current
2. **Permission Audits**: Review permission checks monthly
3. **User Feedback**: Collect feedback on Aaron's responses
4. **Response Quality**: Monitor and improve AI responses
5. **Privacy**: Never log sensitive user data
6. **Transparency**: Inform users when they hit rate limits

## Support

For issues or questions:
- Check browser console for errors
- Review server logs
- Test in offline mode first
- Verify user permissions
- Contact development team

---

**Note**: Aaron works perfectly in offline mode for development and testing. Socket.io server is only needed for advanced AI features in production.
