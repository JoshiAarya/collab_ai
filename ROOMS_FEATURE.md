# Multi-Room Chat Feature 🏠

The CollabAI chat application now supports multiple chat rooms with a sidebar interface.

## Features

✅ **Multiple Chat Rooms**: Create and join different conversation spaces  
✅ **Sidebar Navigation**: Toggle between rooms with a collapsible sidebar  
✅ **Room-Specific Messages**: Each room maintains its own message history  
✅ **AI Context per Room**: CollabAI maintains separate context for each room  
✅ **Real-time Room Switching**: Instant room switching without page reload  
✅ **Room Statistics**: See message counts for each room  

## Default Rooms

The application comes with three default rooms:
- **#general** - General discussion
- **#random** - Random conversations  
- **#help** - Ask for help here

## Usage

### Joining Rooms
- Click on any room in the sidebar to switch
- Messages are loaded instantly when switching rooms
- Your current room is highlighted in green

### Creating New Rooms
- Click the "+ Create Room" button in the sidebar
- Enter a room name and optional description
- Room is created and available to all users immediately

### Sidebar Controls
- Click the arrow button to collapse/expand the sidebar
- When collapsed, a toggle button appears on the left side
- Sidebar state persists during your session

## Technical Implementation

### Backend Changes
- **Room Model**: New MongoDB collection for room metadata
- **Message Model**: Updated with `roomId` field for room association
- **Room Service**: Handles room creation, management, and statistics
- **WebSocket Updates**: Room-based message broadcasting
- **API Endpoints**: REST endpoints for room management

### Frontend Changes
- **Sidebar Component**: Collapsible room navigation
- **Room State Management**: Track current room and available rooms
- **WebSocket Handling**: Room switching and room-specific messages
- **Responsive Design**: Sidebar adapts to screen size

## API Endpoints

```
GET /api/rooms              # Get all rooms with statistics
POST /api/rooms             # Create a new room
GET /api/messages?roomId=X  # Get messages for specific room
GET /api/stats?roomId=X     # Get statistics for specific room
```

## WebSocket Events

```javascript
// Join a room
{ type: "join-room", roomId: "general" }

// Room switched response
{ type: "room-switched", messages: [...], currentRoom: "general" }

// Available rooms
{ type: "rooms", rooms: [...] }

// Chat message (room-specific)
{ type: "chat", message: { user, text, time, roomId } }
```

## Database Schema

### Rooms Collection
```javascript
{
  name: String,           // Room identifier (e.g., "general")
  description: String,    // Room description
  isPrivate: Boolean,     // Future: private room support
  createdBy: String,      // Username who created the room
  lastActivity: Date,     // Last message timestamp
  createdAt: Date,        // Room creation date
  updatedAt: Date         // Last update
}
```

### Messages Collection (Updated)
```javascript
{
  user: String,           // Username
  text: String,           // Message content
  roomId: String,         // Room identifier
  timestamp: Number,      // Unix timestamp
  createdAt: Date,        // Auto-generated
  updatedAt: Date         // Auto-generated
}
```

## Future Enhancements

- **Private Rooms**: Invite-only rooms with access control
- **Room Permissions**: Admin/moderator roles
- **Room Themes**: Custom styling per room
- **Room Archives**: Export/import room history
- **Voice Channels**: Audio chat integration
- **File Sharing**: Room-specific file uploads
- **Room Search**: Search messages across rooms
- **Notifications**: Unread message indicators

## Migration Notes

Existing messages are automatically assigned to the "general" room. No data loss occurs during the upgrade. The application maintains backward compatibility with single-room setups.