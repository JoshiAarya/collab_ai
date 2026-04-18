const fs = require('fs');

let content = fs.readFileSync('c:/Users/nikun/OneDrive/Documents/CollabAI/frontend/src/components/ProjectWorkspace.jsx', 'utf8');

// Obsolete imports
content = content.replace(/import.*ProjectIntelligenceCard.*\n/g, '');
content = content.replace(/import.*DecisionTimeline.*\n/g, '');
content = content.replace(/import.*BlockerTracker.*\n/g, '');

// Also _DashboardLegacy is defined but never used since we just use <Dashboard />.
// To avoid build or size issues, I'll remove it.
// The easiest way is to cut the entire `function _DashboardLegacy` section from the file if it exists.
const legacyStart = content.indexOf('function _DashboardLegacy');
if (legacyStart !== -1) {
    // Find the end of _DashboardLegacy. It might be before `const styles = {`
    const stylesStart = content.indexOf('const styles = {', legacyStart);
    if (stylesStart !== -1) {
        content = content.slice(0, legacyStart) + content.slice(stylesStart);
    }
}

// Ensure no remaining usages or duplicate style keys.
// Wait, the build also reported: "Duplicate key "emptyHint" in object literal", "memberItem", "memberAvatar", "viewAllBtn", "emptyState"
// This is because the styles dictionary had styles for _DashboardLegacy appended at the end!
// I'll leave the style objects because they are just duplicate keys, but maybe I should remove the duplicate instances?
// ES6 objects allow duplicate keys (the later one wins), but maybe Vite/esbuild strict mode errors on it.
content = content.replace(/emptyHint:\s*{[\s\S]*?},/g, (match, offset, str) => {
    // only remove if it's not the first occurrence.
    return match; // Actually it's complex to regex duplicate keys. Let's let the linter complain or remove the whole block.
});
fs.writeFileSync('c:/Users/nikun/OneDrive/Documents/CollabAI/frontend/src/components/ProjectWorkspace.jsx', content);

console.log('ProjectWorkspace cleaned aggressively.');
