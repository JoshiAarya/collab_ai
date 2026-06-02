import dotenv from 'dotenv'; dotenv.config();
import connectDB from '../config/database.js';
import '../models/User.js';
import '../models/Message.js';
import '../models/Summary.js';
import Project from '../models/Project.js';
import discussionService from '../services/discussionService.js';
await connectDB();
const projects = await Project.find({}).lean();
for (const p of projects) {
  const discs = await discussionService.getProjectDiscussions(p._id.toString());
  let total = 0;
  for (const d of discs) {
    const msgs = await discussionService.getDiscussionMessages(d._id, 500);
    total += msgs.filter(m => m.user !== 'System').length;
    console.log(`  [${d.title}] ${msgs.length} msgs`);
  }
  console.log(`${p.title} — total: ${total}`);
}
process.exit(0);
