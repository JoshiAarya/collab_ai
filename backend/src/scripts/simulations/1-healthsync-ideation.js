import { runSimulation } from './healthsync-base.js';
import { usersToCreate, stage1_ideation } from './healthsync-data.js';

runSimulation({
  projectTitle: 'HealthSync (Ideation)',
  projectDesc: 'Ideation phase of a telemedicine app. Evaluates if the system correctly infers the "Ideation" stage.',
  usersToCreate,
  conversations: [...stage1_ideation]
}).catch(console.error);
