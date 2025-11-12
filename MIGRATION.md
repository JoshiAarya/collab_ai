# Migration Guide: In-Memory to MongoDB

This guide helps you migrate from the in-memory message storage to MongoDB persistent storage.

## What Changed

✅ **Messages now persist** across server restarts  
✅ **Better performance** with database indexing  
✅ **Scalable storage** for large message histories  
✅ **API endpoints** for message management  
✅ **No frontend changes** required  

## Migration Steps

### 1. Install MongoDB
Choose one option:

**Local MongoDB:**
```bash
# Windows (with Chocolatey)
choco install mongodb

# macOS (with Homebrew)  
brew install mongodb-community

# Ubuntu/Debian
sudo apt install mongodb
```

**MongoDB Atlas (Cloud - Recommended):**
- Sign up at [MongoDB Atlas](https://www.mongodb.com/atlas)
- Create free cluster
- Get connection string

### 2. Update Backend
```bash
cd backend
npm install mongoose
```

### 3. Configure Environment
Update your `.env` file:
```env
CHATBOT_API_KEY=your_existing_key
PORT=8080
MONGODB_URI=mongodb://localhost:27017/collab-chat
# OR for Atlas: mongodb+srv://username:password@cluster.mongodb.net/collab-chat
```

### 4. Test Setup
```bash
npm run setup
```

### 5. Start Application
```bash
npm start
```

## Verification

1. **Check server logs** - Should see "MongoDB Connected"
2. **Send test message** - Should persist after server restart
3. **API test** - Visit `http://localhost:8080/api/stats`

## Rollback (if needed)

If you encounter issues, you can temporarily rollback by:
1. Reverting to the previous `index.js` 
2. Removing MongoDB dependencies
3. Using the old in-memory array

## New Features Available

- **Message History API**: `GET /api/messages`
- **Statistics**: `GET /api/stats` 
- **Cleanup**: `DELETE /api/messages/cleanup?days=30`
- **Persistent AI Context**: AI remembers conversation history

## Troubleshooting

**Connection Issues:**
- Verify MongoDB is running locally
- Check connection string format
- Ensure network access for Atlas

**Performance:**
- Database is indexed for optimal query performance
- Recent messages are cached for new connections

## Next Steps

With MongoDB in place, you can now add:
- User authentication
- Message search
- File attachments
- Message reactions
- Room/channel support