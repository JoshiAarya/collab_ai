import { runSimulation } from './buildboard-base.js';
import { usersToCreate, stage1_ideation, stage2_planning, stage3_development, stage4_testing, stage5_deployment } from './buildboard-data.js';

runSimulation({
  projectTitle: 'BuildBoard (Full)',
  projectDesc: 'Full lifecycle of a construction management app from ideation to launch. Evaluates the full trajectory of system stage inference and CI/CD/architecture discussions.',
  usersToCreate,
  conversations: [...stage1_ideation, ...stage2_planning, ...stage3_development, ...stage4_testing, ...stage5_deployment]
}).catch(console.error);
