# User Persistence Feature 👤

The CollabAI chat application now includes comprehensive user persistence with localStorage and database tracking.

## Features

✅ **Persistent Usernames**: Usernames are saved locally and persist across browser sessions  
✅ **Welcome Modal**: New users get a friendly onboarding experience  
✅ **Random Username Generator**: Quick username generation with fun combinations  
✅ **User Database Tracking**: Backend tracks user statistics and activity  
✅ **Online Status**: Real-time online/offline user tracking  
✅ **User Statistics**: Message counts and activity tracking  
✅ **Username Changes**: Users can change their username anytime  

## User Experience

### First Visit
1. **Welcome Modal**: Users see a friendly welcome screen
2. **Username Selection**: Choose custom username or generate random one
3. **Local Storage**: Username is saved in browser localStorage
4. **Instant Access**: Direct entry to chat after username selection

### Returning Users
- **Automatic Login**: Saved username loads automatically
- **No Re-authentication**: Seamless experience across sessions
- **Username Display**: Current username shown in header with change option

### Username Management
- **Click to Change**: Click username in header to change it
- **Random Generation**: Smart random username generator with adjectives + nouns
- **Validation**: Username length limits (1-20 characters)
- **Real-time Updates**: Changes reflect immediately

## Technical Implementation

### Frontend (localStorage)
```javascript
// Save username
localStorage.setItem('collab-ai-username', username);

// Retrieve username
const savedUsername = localStorage.getItem('collab-ai-username');

// Username persistence across page reloads
useEffect(() => {
  const savedUsername = localStorage.getItem('collab-ai-username');
  if (savedUsername) {
    setUsername(savedUsername);
  } else {
    setShowUsernameModal(true);
  }
}, []);
```

### Backend (Database Tracking)
- **User Model**: MongoDB collection for user data
- **Auto-creation**: Users created automatically on first message
- **Activity Tracking**: Last seen timestamps and online status
- **Statistics**: Message counts and room participation
- **Cleanup**: Automatic offline status updates

## Database Schema

### Users Collection
```javascript
{
  username: String,        // Unique username (1-20 chars)
  lastSeen: Date,         // Last activity timestamp
  isOnline: Boolean,      // Current online status
  joinedRooms: [String],  // Rooms user has participated in
  messageCount: Number,   // Total messages sent
  createdAt: Date,        // Account creation date
  updatedAt: Date         // Last update timestamp
}
```

## API Endpoints

```
GET /api/users/online     # Get currently online users
GET /api/users/stats      # Get all users with statistics
```

## Features in Detail

### Welcome Modal
- **Friendly Design**: GitHub-inspired dark theme
- **Input Validation**: Real-time validation and feedback
- **Random Generator**: Fun username combinations
- **Accessibility**: Keyboard navigation and focus management

### Online Users Display
- **Sidebar Integration**: Shows online users in sidebar
- **Real-time Updates**: Updates every 30 seconds
- **User Limit**: Shows up to 10 users with "more" indicator
- **Visual Indicators**: Green dot for online status

### Username Generator
```javascript
const adjectives = ['Cool', 'Smart', 'Fast', 'Bright', 'Quick', 'Sharp'];
const nouns = ['Coder', 'Dev', 'User', 'Ninja', 'Pro', 'Ace'];
// Generates: CoolCoder123, SmartNinja456, etc.
```

### Automatic Cleanup
- **Offline Detection**: Users marked offline after 5 minutes of inactivity
- **Periodic Cleanup**: Runs every 2 minutes
- **Graceful Handling**: No data loss, just status updates

## Benefits

### For Users
- **No Account Creation**: Start chatting immediately
- **Persistent Identity**: Same username across sessions
- **Easy Management**: Simple username changes
- **Privacy Friendly**: No email or personal info required

### For Developers
- **Simple Integration**: localStorage + optional backend tracking
- **Scalable Design**: Handles many concurrent users
- **Analytics Ready**: User statistics and activity data
- **Flexible**: Can add authentication later if needed

## Migration Notes

- **Backward Compatible**: Existing users get username modal on next visit
- **No Data Loss**: All existing messages remain intact
- **Gradual Adoption**: Users migrate to persistent usernames naturally

## Future Enhancements

- **User Profiles**: Avatar uploads and bio information
- **Authentication**: Optional account creation with passwords
- **User Preferences**: Theme settings and notification preferences
- **Friend System**: Add friends and direct messaging
- **User Roles**: Admin and moderator permissions
- **Activity History**: Detailed user activity logs

## Configuration

### Frontend Settings
```javascript
// Username constraints
const MIN_USERNAME_LENGTH = 1;
const MAX_USERNAME_LENGTH = 20;

// Update intervals
const ONLINE_USERS_UPDATE_INTERVAL = 30000; // 30 seconds
```

### Backend Settings
```javascript
// Offline detection threshold
const OFFLINE_THRESHOLD_MINUTES = 5;

// Cleanup interval
const CLEANUP_INTERVAL_MINUTES = 2;
```

The user persistence system provides a seamless, privacy-friendly way for users to maintain their identity across sessions while giving developers valuable insights into user engagement and activity patterns.