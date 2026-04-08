import { runSimulation } from './healthsync-base.js';
import { usersToCreate, stage1_ideation, stage2_planning, stage3_development, stage4_testing } from './healthsync-data.js';

runSimulation({
  projectTitle: 'HealthSync (Testing)',
  projectDesc: 'Testing and QA phase of a telemedicine app. Evaluates if the system correctly infers the "Testing" stage.',
  usersToCreate,
  conversations: [...stage1_ideation, ...stage2_planning, ...stage3_development, ...stage4_testing]
}).catch(console.error);
