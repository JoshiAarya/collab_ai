const fs = require('fs');

const dKeywords = [
  "We can use JSONB columns in Postgres",
  "AWS makes the most sense since",
  "Postgres with JSONB it is",
  "Let's stick to REST for MVP",
  "I prefer short-lived JWTs paired",
  "Agreed on Vite",
  "I propose Zustand for global state",
  "Let's use Tailwind CSS with Shadcn UI",
  "ECS with Fargate gives us serverless Docker",
  "Let's establish our CI/CD pipeline purely through GitHub Actions",
  "we will use webhooks backed strictly by SQS instead of cron polling",
  "instead of DocuSign we're going with HelloSign",
  "I'll implement react-pdf with virtualized",
  "Let's create a `processed_stripe_events` table",
  "I can inject a mock configuration for the HelloSign SDK",
  "moving to PostgreSQL's native `tsvector`",
  "A daily digest batch job is much safer",
  "I am rewriting the RBAC middleware on that controller",
  "HIPAA compliance dictates that all patient PHI",
  "we establish a dedicated EHR integration microservice",
  "React Native is the only sensible choice",
  "we will implement OAuth 2.0 with strict short-lived JWTs",
  "I propose we use GraphQL for the main patient app",
  "Let's use a managed PostgreSQL instance for structured patient data",
  "I'll provision the AWS health-compliant HIPAA infrastructure",
  "We will use Redux Toolkit for the React Native state",
  "Instead of cron polling, we will use AWS EventBridge",
  "implementing AES-256-GCM application-level encryption for all PHI",
  "using FHIR standard JSON structures for all external interoperability"
];

['buildboard-data.js', 'healthsync-data.js'].forEach(file => {
  let content = fs.readFileSync('src/scripts/simulations/' + file, 'utf8');
  
  const lines = content.split('\n');
  const newLines = lines.map(line => {
    for (const kw of dKeywords) {
      if (line.includes(kw) && !line.includes('isDecision')) {
        return line.replace(/ \},?$/, ', isDecision: true }').replace(/ \}(?!,)/, ', isDecision: true }');
      }
    }
    return line;
  });
  fs.writeFileSync('src/scripts/simulations/' + file, newLines.join('\n'));
  console.log(`Updated ${file}`);
});
