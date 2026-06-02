import { runSimulation } from './healthsync-base.js';
import { usersToCreate, stage1_ideation, stage2_planning } from './healthsync-data.js';

runSimulation({
  projectTitle: 'HealthSync (Planning)',
  projectDesc: 'Planning phase of a telemedicine app. Evaluates if the system correctly infers "Planning/Architecture" stage.',
  usersToCreate,
  conversations: [...stage1_ideation, ...stage2_planning]
}).catch(console.error);
