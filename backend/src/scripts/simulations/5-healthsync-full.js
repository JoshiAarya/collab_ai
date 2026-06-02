import { runSimulation } from './healthsync-base.js';
import { usersToCreate, stage1_ideation, stage2_planning, stage3_development, stage4_testing, stage5_deployment } from './healthsync-data.js';

runSimulation({
  projectTitle: 'HealthSync (Full)',
  projectDesc: 'Full lifecycle of a telemedicine app from ideation to launch. Evaluates the full trajectory of system stage inference.',
  usersToCreate,
  conversations: [...stage1_ideation, ...stage2_planning, ...stage3_development, ...stage4_testing, ...stage5_deployment]
}).catch(console.error);
