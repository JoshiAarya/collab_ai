import { runSimulation } from './healthsync-base.js';
import { usersToCreate, stage1_ideation, stage2_planning, stage3_development } from './healthsync-data.js';

runSimulation({
  projectTitle: 'HealthSync (Development)',
  projectDesc: 'Development phase of a telemedicine app. Evaluates if the system correctly infers the "Development" stage.',
  usersToCreate,
  conversations: [...stage1_ideation, ...stage2_planning, ...stage3_development]
}).catch(console.error);
