import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from './src/config/database.js';
import Project from './src/models/Project.js';
import discussionService from './src/services/discussionService.js';
import AIOrchestrator from './src/core/orchestrator/AIOrchestrator.js';

const questions = [
  "Why did the team choose Postgres over MongoDB?",
  "Who proposed switching to HelloSign and why?",
  "What was the search performance issue and how was it resolved?",
  "What is the current authentication approach?",
  "Who is responsible for setting up the Firecracker microVM pool?",
  "What container orchestration strategy did the team decide on and why?",
  "What was the security vulnerability found during testing?",
  "What is the current approach for handling webhook events from document signing?",
  "Catch me up on the infrastructure decisions made so far.",
  "What open problems or unresolved questions does the project currently have?"
];

async function main() {
  await connectDB();
  console.log('Connected to DB');

  const project = await Project.findOne({ title: 'BuildBoard (Full)' });
  if (!project) {
    console.error("Project 'BuildBoard (Full)' not found");
    process.exit(1);
  }

  const discussions = await discussionService.getProjectDiscussions(project._id);
  const mainDisc = discussions.find(d => d.isMain);

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    console.log(`\n\n=== QUESTION ${i + 1} ===\n${q}\n`);
    
    try {
      const resp = await AIOrchestrator.handleRequest({
        projectId: project._id,
        discussionId: mainDisc._id,
        prompt: q,
        llmConfig: { provider: 'groq', model: 'llama-3.3-70b-versatile' } // Using a fast/good model for reasoning
      });
      console.log(`--- RESPONSE ---\n${resp}`);
    } catch (e) {
      console.error(`Error for question ${i + 1}:`, e.message);
    }
  }

  process.exit(0);
}

main().catch(console.error);
