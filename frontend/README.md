# CollabAI Frontend

React-based frontend for the Real-Time AI Collaborative Workspace.

## Features

- **Authentication**: Email/password login and registration
- **Project Management**: Create, join, and manage projects
- **Real-time Chat**: WebSocket-based messaging
- **AI Integration**: Invoke CollabAI with `@CollabAI` mentions
- **Parallel Discussions**: Multiple focused conversations per project
- **Document Upload**: Upload project documents for AI context
- **Dashboard**: Project insights (owner only)
- **Settings**: Configure LLM provider and invite codes

## Tech Stack

- **React 19** - UI framework
- **Vite** - Build tool and dev server
- **WebSocket** - Real-time communication
- **Marked** - Markdown rendering
- **DOMPurify** - XSS protection

## Setup

### Install Dependencies
```bash
npm install
```

### Start Development Server
```bash
npm run dev
```

Frontend runs on `http://localhost:5173`

### Build for Production
```bash
npm run build
```

### Preview Production Build
```bash
npm run preview
```

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Auth.jsx              # Login/Register
│   │   ├── ProjectList.jsx       # Project list view
│   │   └── ProjectWorkspace.jsx  # Main workspace
│   ├── contexts/
│   │   └── AuthContext.jsx       # Auth state management
│   ├── assets/
│   │   └── react.svg
│   ├── App.jsx                   # Main app with routing
│   ├── main.jsx                  # Entry point
│   └── index.css                 # Global styles
├── public/
├── index.html
├── vite.config.js
└── package.json
```

## Components

### Auth.jsx
- Login and registration forms
- Email/password authentication
- Form validation
- Error handling

### ProjectList.jsx
- Display user's projects
- Create new project modal
- Join project via invite code
- Project cards with metadata

### ProjectWorkspace.jsx
- Main collaboration interface
- Sidebar with discussions
- Real-time chat area
- AI invocation with `@CollabAI`
- Dashboard view (owner only)
- Documents view
- Settings view

## State Management

### AuthContext
Provides authentication state and methods:
- `user` - Current user object
- `token` - JWT token
- `loading` - Loading state
- `login(email, password)` - Login method
- `register(username, email, password)` - Register method
- `logout()` - Logout method

## WebSocket Integration

### Connection
```javascript
const ws = new WebSocket('ws://localhost:8080');
```

### Authentication
```javascript
ws.send(JSON.stringify({ type: 'auth', token }));
```

### Join Project
```javascript
ws.send(JSON.stringify({
  type: 'join-project',
  projectId,
  discussionId
}));
```

### Send Message
```javascript
ws.send(JSON.stringify({
  type: 'project-chat',
  text: message
}));
```

### Receive Messages
```javascript
ws.onmessage = (e) => {
  const data = JSON.parse(e.data);
  if (data.type === 'project-chat') {
    // Handle new message
  }
};
```

## API Integration

### Base URL
```javascript
const API_URL = 'http://localhost:8080/api';
```

### Authentication Headers
```javascript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

### Example: Create Project
```javascript
const response = await fetch('http://localhost:8080/api/projects', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({ title, problemStatement })
});
```

## Styling

Uses inline styles with a dark theme inspired by GitHub:
- Background: `#0d1117`
- Cards: `#161b22`
- Borders: `#30363d`
- Primary: `#238636` (green)
- Text: `#fff`

## Features Detail

### AI Invocation
Type `@CollabAI` followed by your question:
```
@CollabAI what have we discussed so far?
@CollabAI summarize the key decisions
@CollabAI what are the next steps?
```

The `@CollabAI` tag is highlighted in the input field.

### Dashboard (Owner Only)
Shows:
- Project stage
- Total messages
- Active discussions
- Document count
- Current topics
- Key decisions
- Open questions
- Suggested next steps

### Documents
- Upload `.txt`, `.md`, or `.pdf` files
- Files are used as context for AI
- View uploaded documents list

### Settings
- View and copy invite code
- Switch active LLM provider
- Configure API keys (stubbed)

## Development

### Hot Module Replacement
Vite provides instant HMR for fast development.

### Linting
```bash
npm run lint
```

### Code Style
- Functional components with hooks
- Inline styles for simplicity
- Context API for global state
- WebSocket for real-time updates

## Environment

### Backend URL
Currently hardcoded to `http://localhost:8080`. For production, use environment variables:

```javascript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
```

## Browser Support

- Modern browsers with WebSocket support
- Chrome, Firefox, Safari, Edge (latest versions)

## Security

- JWT tokens stored in localStorage
- XSS protection with DOMPurify
- Markdown rendering sanitized
- CORS handled by backend

## Performance

- Lazy loading for large message lists
- Auto-scroll to latest message
- Efficient re-renders with React hooks
- WebSocket for low-latency updates

## Troubleshooting

**WebSocket not connecting**
- Check backend is running on port 8080
- Verify WebSocket URL: `ws://localhost:8080`

**Authentication failing**
- Check token is stored in localStorage
- Verify backend JWT_SECRET matches

**Messages not appearing**
- Check WebSocket connection status
- Verify you're in the correct discussion
- Check browser console for errors

**Dashboard not loading**
- Ensure you're the project owner
- Check backend AI service is configured
- Verify Gemini API key is set

## Future Enhancements

- [ ] Typing indicators
- [ ] Message reactions
- [ ] File preview
- [ ] Search functionality
- [ ] Notifications
- [ ] Dark/light theme toggle
- [ ] Mobile responsive design
- [ ] Offline support
- [ ] Message editing/deletion
- [ ] User profiles

## Scripts

```bash
npm run dev      # Start dev server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

## Dependencies

### Production
- `react` - UI framework
- `react-dom` - React DOM rendering
- `marked` - Markdown parser
- `dompurify` - HTML sanitizer

### Development
- `vite` - Build tool
- `@vitejs/plugin-react` - React plugin for Vite
- `eslint` - Linting

## License

MIT
