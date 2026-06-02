export const usersToCreate = ['dr_smith', 'alice', 'bob', 'charlie'];

export const threadSummaries = {
  'Frontend': 'Focuses on the React-based user interface, UI/UX design components, client-side LiveKit video integration, and the overall patient/doctor dashboard experience.',
  'Backend': 'Focuses on the Node.js API server, Postgres database schema modeling, JWT authentication, RBAC, WebSockets integration, and background worker queues.',
  'Infrastructure': 'Handles cloud deployment, VPC setup, database encryption, LiveKit self-hosting, Redis streams, system metrics, and HIPAA compliance enforcement.',
  'Testing': 'Dedicated to QA tracking, Cypress end-to-end testing, security vulnerability scanning, load testing, and resolving platform bugs.'
};

export const stage1_ideation = [
  { thread: 'Main', user: 'dr_smith', text: 'Hey team, let\'s kick off the HealthSync project today. The goal is to build a modern telemedicine platform where patients can book appointments and have secure video consultations with doctors.' },
  { thread: 'Main', user: 'alice', text: 'Sounds like a great initiative. What are the key user roles we need to support for MVP?' },
  { thread: 'Main', user: 'dr_smith', text: 'Just two to start: Doctors and Patients. And eventually an Admin role, but let\'s keep it out of scope for v1.' },
  { thread: 'Main', user: 'bob', text: 'For the patient side, do they need to upload medical documents before the call?' },
  { thread: 'Main', user: 'dr_smith', text: 'Yes, a simple file upload feature during the booking process would be ideal so doctors can review the history.' },
  { thread: 'Main', user: 'charlie', text: 'Since we are dealing with medical records and patient data, HIPAA compliance is absolutely critical. We need strict data encryption at rest and in transit.' },
  { thread: 'Main', user: 'alice', text: 'Agreed. That means we cannot use just any public cloud SaaS without a BAA. We should probably self-host as much as possible.' },
  { thread: 'Main', user: 'dr_smith', text: 'What about the video conferencing piece? Building WebRTC from scratch sounds like a massive headache.' },
  { thread: 'Main', user: 'bob', text: 'We definitely shouldn\'t build it from scratch. There are open-source WebRTC frameworks we could use.' },
  { thread: 'Main', user: 'alice', text: 'I\'ll look into the backend options for WebRTC signaling. Maybe something we can run on our own instances.' },
  { thread: 'Main', user: 'dr_smith', text: 'We also need a clean dashboard for doctors to see their upcoming appointments for the week, and a simple calendar booking node for patients.' },
  { thread: 'Main', user: 'bob', text: 'I can leverage some existing React calendar libraries for that. We\'ll need to ensure timezones are handled correctly though.' },
  { thread: 'Main', user: 'alice', text: 'Timezones are always tricky. Let\'s make sure we store all datetime fields in UTC in the database, and only convert to local time on the frontend.' },
  { thread: 'Main', user: 'bob', text: 'Good call. I\'ll enforce UTC-only payload structures from the React client to the Node API.' },
  { thread: 'Main', user: 'charlie', text: 'Before we go too deep, how are we handling user authenticated sessions? Since it\'s web-first.' },
  { thread: 'Main', user: 'alice', text: 'Let\'s hash that out in the Backend thread. I have some strong opinions on stateless auth.' },
  { thread: 'Main', user: 'dr_smith', text: 'Perfect. I will create specific discussion threads for Frontend, Backend, Infrastructure, and Testing where we can distribute the detailed technical work.' },
  { thread: 'Main', user: 'dr_smith', text: 'Let\'s map out the architecture documents today and start sprinting tomorrow.' },
  { thread: 'Main', user: 'bob', text: 'I\'ll gather some UI inspiration for the dashboard and post it in the Frontend thread.' },
  { thread: 'Main', user: 'charlie', text: 'And I\'ll start writing up the AWS infrastructure requirements.' }
];

export const stage2_planning = [
  { thread: 'Backend', user: 'alice', text: 'Let us finalize the backend architecture. For the web server, I propose using Node.js with Express.' },
  { thread: 'Backend', user: 'charlie', text: 'Express is fine, but maybe Fastify for better performance?' },
  { thread: 'Backend', user: 'alice', text: 'Express has a larger ecosystem and more middleware for things like rate limiting and security headers which we need right away. Let\'s stick with Express.', isDecision: true },
  { thread: 'Backend', user: 'charlie', text: 'Fair enough. For the database, since patient records will have complex documents, should we use MongoDB?' },
  { thread: 'Backend', user: 'alice', text: 'Given the strict financial and medical transaction nature, we need strong ACID compliance. I strongly suggest we use Postgres instead. We can use JSONB columns if we need document flexibility.', isDecision: true },
  { thread: 'Backend', user: 'charlie', text: 'Okay, Postgres it is. I will provision a managed Postgres instance with automated daily backups.' },
  { thread: 'Backend', user: 'alice', text: 'For authentication, we should use JWTs but with short expirations and httpOnly secure cookies to mitigate XSS.', isDecision: true },
  { thread: 'Backend', user: 'charlie', text: 'Yes, and we need role-based access control (RBAC). A patient absolutely cannot access another patient\'s records.' },
  { thread: 'Frontend', user: 'bob', text: 'Over on the frontend, I\'m setting up the React boilerplate. We will use Vite instead of Create React App for faster builds.', isDecision: true },
  { thread: 'Frontend', user: 'dr_smith', text: 'Sounds good. What about styling? Should we use Tailwind CSS or styled-components?' },
  { thread: 'Frontend', user: 'bob', text: 'Let\'s adopt Tailwind CSS. It will speed up our UI development significantly, especially for the complex dashboard layouts.', isDecision: true },
  { thread: 'Frontend', user: 'bob', text: 'For state management, we should use Zustand. It\'s lighter than Redux and perfect for our needs.', isDecision: true },
  { thread: 'Infrastructure', user: 'charlie', text: 'Looking into the video call infrastructure. LiveKit seems to be the best open-source WebRTC option.' },
  { thread: 'Infrastructure', user: 'alice', text: 'Can we self-host LiveKit to maintain HIPAA compliance?' },
  { thread: 'Infrastructure', user: 'charlie', text: 'Yes, we can deploy the LiveKit server on our own EC2 instances within a private VPC. I\'ve read through their deployment docs.', isDecision: true },
  { thread: 'Frontend', user: 'bob', text: 'LiveKit has an amazing React SDK. I\'ll use that to build the video room components.' },
  { thread: 'Backend', user: 'alice', text: 'We also need a background worker system to send email reminders 24 hours before an appointment.' },
  { thread: 'Backend', user: 'charlie', text: 'I\'ll set up Redis. We can use BullMQ to manage the job queues reliably.', isDecision: true },
  { thread: 'Backend', user: 'alice', text: 'Perfect. Keep the Redis instance inside the VPC so it\'s isolated from the public internet.' },
  { thread: 'Infrastructure', user: 'charlie', text: 'I am creating the Terraform scripts now to codify the Postgres, Redis, and EC2 deployments.' },
  { thread: 'Frontend', user: 'bob', text: 'I\'ve created the initial Figma wireframes for the patient booking flow. It\'s a clean 3-step wizard.' },
  { thread: 'Backend', user: 'alice', text: 'Make sure step 2 of the wizard allows them to upload PDFs. I\'ll build the S3 bucket pre-signed URL endpoint for direct uploads.' }
];

export const stage3_development = [
  { thread: 'Backend', user: 'alice', text: 'I\'ve pushed the initial Postgres schema. The Users, Appointments, and MedicalRecords tables are live.' },
  { thread: 'Backend', user: 'charlie', text: 'I\'m reviewing the RBAC middleware PR now. Looks solid, but make sure to add generic error messages so we don\'t leak route info on 403s.' },
  { thread: 'Backend', user: 'alice', text: 'Good catch, fixing the error responses now.' },
  { thread: 'Frontend', user: 'bob', text: 'The doctor dashboard layout is complete. I\'ve built the calendar view using react-big-calendar.' },
  { thread: 'Frontend', user: 'dr_smith', text: 'The calendar looks great! But how do we handle the transition when a doctor actually enters the video room?' },
  { thread: 'Backend', user: 'alice', text: 'I\'m working on the LiveKit integration right now. When the doctor clicks "Join", they will hit an endpoint that generates a secure LiveKit access token.' },
  { thread: 'Frontend', user: 'bob', text: 'Okay, once I get that token, I can initialize the LiveKit `LiveKitRoom` component. But how does the doctor know the patient is waiting?' },
  { thread: 'Backend', user: 'alice', text: 'We should use WebSockets. When the patient connects, our backend will emit a `participant_joined` event down to the doctor\'s client.', isDecision: true },
  { thread: 'Frontend', user: 'bob', text: 'I\'ll integrate Socket.io on the frontend to listen for those room status events.' },
  { thread: 'Infrastructure', user: 'charlie', text: 'The LiveKit server is fully deployed in the staging VPC. Alice, I DM\'d you the API keys and secret.' },
  { thread: 'Backend', user: 'alice', text: 'Thanks! I\'ve configured the environment variables and the token generation is working.' },
  { thread: 'Frontend', user: 'dr_smith', text: 'Make sure the doctor can also share their screen if they need to show lab results during the call.' },
  { thread: 'Frontend', user: 'bob', text: 'Will do. I am adding the `ScreenShare` component from the LiveKit SDK right now.' },
  { thread: 'Backend', user: 'charlie', text: 'Alice, I noticed some performance issues locally. We have an N+1 query problem in the appointment fetching endpoint.' },
  { thread: 'Backend', user: 'charlie', text: 'It\'s doing a separate query for every single patient profile attached to the appointments.' },
  { thread: 'Backend', user: 'alice', text: 'Ah, my bad. I will add an INNER JOIN to fetch the patient details alongside the appointment to optimize that lookup.' },
  { thread: 'Frontend', user: 'bob', text: 'Just pushed the video UI. It handles camera/mic muting seamlessly. I\'m moving on to building the post-call prescription form.' },
  { thread: 'Backend', user: 'alice', text: 'The BullMQ worker for email reminders is implemented. It scans for appointments starting in < 24 hours.' },
  { thread: 'Infrastructure', user: 'charlie', text: 'I\'ve verified the worker is running. I had to increase the Redis maxmemory-policy to allkeys-lru to prevent OOM errors.' },
  { thread: 'Frontend', user: 'bob', text: 'I am integrating the prescription form with the backend endpoint. Currently hitting a CORS error though on the staging environment.' },
  { thread: 'Infrastructure', user: 'charlie', text: 'Let me update the allowed origins in the Nginx reverse proxy. It should only accept requests from our specific frontend domain.' },
  { thread: 'Frontend', user: 'bob', text: 'CORS issue resolved. The prescription form is successfully submitting now.' }
];

export const stage4_testing = [
  { thread: 'Testing', user: 'charlie', text: 'I ran automated security scans on our staging environment using OWASP ZAP.' },
  { thread: 'Testing', user: 'charlie', text: 'We have a critical vulnerability in our JWT validation—we weren\'t strictly verifying the issuer claim.' },
  { thread: 'Backend', user: 'alice', text: 'Wow, scary. I will implement a strict issuer verification check in the auth middleware immediately.' },
  { thread: 'Testing', user: 'dr_smith', text: 'I did a manual walkthrough of the patient booking flow. It was very smooth. However, during the video test, I heard a terrible audio echo.' },
  { thread: 'Frontend', user: 'bob', text: 'Ah, I think I missed a configuration in the WebRTC setup. I need to explicitly enable echo cancellation in the LiveKit room options.' },
  { thread: 'Frontend', user: 'bob', text: 'I\'m pushing a hotfix now to set `echoCancellation: true`.' },
  { thread: 'Testing', user: 'dr_smith', text: 'Retesting the video room... The echo is completely gone. Great job Bob.' },
  { thread: 'Testing', user: 'alice', text: 'I just finished running the K6 load tests against the staging backend.' },
  { thread: 'Testing', user: 'alice', text: 'Our database handles 500 concurrent bookings without breaking a sweat, but the email worker queue was logging an enormous lag.' },
  { thread: 'Testing', user: 'alice', text: 'It took almost 20 minutes for some reminder emails to actually dispatch under load.' },
  { thread: 'Infrastructure', user: 'charlie', text: 'That\'s unacceptable for our SLAs. I will bump the background worker instances from 1 to 3.' },
  { thread: 'Infrastructure', user: 'charlie', text: 'I also think we should switch from standard Redis Lists to Redis Streams for better queue management and consumer group scaling.', isDecision: true },
  { thread: 'Backend', user: 'alice', text: 'Sounds like a plan. I\'ll update the BullMQ configuration to leverage the new Redis parameters.' },
  { thread: 'Testing', user: 'dr_smith', text: 'Is the file upload feature verified? Patients uploading previous medical PDFs?' },
  { thread: 'Testing', user: 'bob', text: 'Yes, I wrote Cypress end-to-end tests that mock the file upload. They are passing.' },
  { thread: 'Backend', user: 'alice', text: 'And I\'ve verified the S3 bucket policies restrict public access. The pre-signed URLs expire after 15 minutes.' },
  { thread: 'Testing', user: 'charlie', text: 'I re-ran the load test with 3 worker instances. The email queue lag is down to under 2 seconds at peak load. We are golden.' },
  { thread: 'Testing', user: 'bob', text: 'All frontend unit tests are passing in the CI pipeline. Code coverage is at 85%.' },
  { thread: 'Testing', user: 'dr_smith', text: 'The screen sharing for lab results works flawlessly. We\'ve addressed all critical bugs. Are we ready for launch?' },
  { thread: 'Testing', user: 'alice', text: 'All end-to-end Cypress tests are passing green. I\'m confident in the backend stability.' },
  { thread: 'Testing', user: 'charlie', text: 'Infrastructure is fully provisioned and locked down. We are good to go.' }
];

export const stage5_deployment = [
  { thread: 'Infrastructure', user: 'charlie', text: 'Initiating the production deployment sequence now. Locking the main branch.' },
  { thread: 'Infrastructure', user: 'charlie', text: 'The Postgres database migrations are running on the production cluster.' },
  { thread: 'Backend', user: 'alice', text: 'Migrations completed successfully. Node instances are spinning up and passing health checks.' },
  { thread: 'Frontend', user: 'bob', text: 'The React frontend bundle is building. It is actively deploying to out global CDN.' },
  { thread: 'Frontend', user: 'bob', text: 'Frontend is live! I\'m monitoring the error logs on Sentry to catch any client-side crashes early.' },
  { thread: 'Infrastructure', user: 'charlie', text: 'LiveKit cluster is up. Routing rules are established. DNS propagation looks complete.' },
  { thread: 'Backend', user: 'dr_smith', text: 'Fantastic. I\'m doing a quick smoke test as a patient on production.' },
  { thread: 'Backend', user: 'dr_smith', text: 'First real test patient successfully booked a slot with me. The transactional email reminder arrived instantly.' },
  { thread: 'Infrastructure', user: 'alice', text: 'Production metrics look completely stable. I am not seeing any memory leaks detected in the LiveKit server after the smoke test.' },
  { thread: 'Infrastructure', user: 'charlie', text: 'Let\'s keep a close eye on the database CPU usage for the first 48 hours. I\'ve set up aggressive Datadog alerts just in case.' },
  { thread: 'Backend', user: 'alice', text: 'I will monitor the BullMQ dashboard to make sure no background jobs get stuck in the failed state.' },
  { thread: 'Frontend', user: 'bob', text: 'Sentry is completely quiet. Zero unhandled promise rejections so far.' },
  { thread: 'Testing', user: 'dr_smith', text: 'Incredible work team. HealthSync v1 is officially live and working perfectly under real-world conditions.' },
  { thread: 'Main', user: 'dr_smith', text: 'I wanted to thank everyone for their hard work over the last few weeks. We built a rock-solid product.' },
  { thread: 'Main', user: 'alice', text: 'It was a great team effort. The infrastructure decisions really paid off.' },
  { thread: 'Main', user: 'bob', text: 'Agreed. Time to celebrate! Let\'s do a formal retro tomorrow to plan v1.1.' }
];

export const allConversations = [
  ...stage1_ideation,
  ...stage2_planning,
  ...stage3_development,
  ...stage4_testing,
  ...stage5_deployment
];
