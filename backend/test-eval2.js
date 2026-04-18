import 'dotenv/config';
import connectDB from './src/config/database.js';
import Project from './src/models/Project.js';
import discussionService from './src/services/discussionService.js';
import AIOrchestrator from './src/core/orchestrator/AIOrchestrator.js';

const questions = [
  "Three weeks into the project, the team changed a major technical decision. What was it, what replaced it, and who drove that change?",
  "What decisions has Prathamesh specifically proposed or been responsible for across the entire project?",
  "We originally chose one approach for document signing but switched. What was the original choice, why did we switch, and what problem triggered it?",
  "Which decisions made during planning were later revised during development, and what caused each revision?",
  "What security issues were found and how were each of them resolved? Who was responsible for each fix?",
  "If a new backend engineer joins today, what are the three most important architectural decisions they need to know about and why were they made?",
  "What performance problems did we hit and what was the before and after for each?",
  "Has the team's approach to email notifications changed at any point? If so what changed and why?",
  "What work did each team member commit to doing by end of the project?",
  "What would you say are the unresolved risks or open questions in this project as it stands?"
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
        llmConfig: { provider: 'groq', model: 'llama-3.1-8b-instant' }
      });
      console.log(`--- RESPONSE ---\n${resp}`);
    } catch (e) {
      console.error(`Error for question ${i + 1}:`, e.message);
    }
  }

  process.exit(0);
}

main().catch(console.error);
