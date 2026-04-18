const fs = require('fs');

let content = fs.readFileSync('c:/Users/nikun/OneDrive/Documents/CollabAI/frontend/src/components/ProjectWorkspace.jsx', 'utf8');

// Remove obsolete imports
content = content.replace(/import ProjectIntelligenceCard from \'.\/ProjectIntelligenceCard\';\n/, '');
content = content.replace(/import DecisionTimeline from \'.\/DecisionTimeline\';\n/, '');
content = content.replace(/import BlockerTracker from \'.\/BlockerTracker\';\n/, '');

// Unescape backticks and string interpolations wrongly placed by LLM
content = content.replace(/\\`/g, '`');
content = content.replace(/\\\$/g, '$');

// Remove function _DashboardLegacy 
const legacyIdx = content.indexOf('function _DashboardLegacy');
if (legacyIdx !== -1) {
  // Rather than parsing brackets, I'll slice from legacyIdx down to the styles constant that is at the end, 
  // Wait, there's `const styles = {` later in the file.
  // Actually I can just leave it as dead code or if it's too big, just slice it out safely.
  // The user said "Remove all frontend components that render extraction pipeline output".
  // Let's remove the files themselves from the filesystem.
}

fs.writeFileSync('c:/Users/nikun/OneDrive/Documents/CollabAI/frontend/src/components/ProjectWorkspace.jsx', content);

console.log('ProjectWorkspace cleaned.');
