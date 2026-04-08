const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir);
    list.forEach((file) => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else {
            if (file.endsWith('.js') || file.endsWith('.jsx')) {
                results.push(file);
            }
        }
    });
    return results;
}

const root = 'c:\\Users\\nikun\\OneDrive\\Documents\\CollabAI';
const frontendFiles = walk(path.join(root, 'frontend', 'src'));
const backendFiles = walk(path.join(root, 'backend', 'src'));

let summary = {};

function analyzeFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const relPath = path.relative(root, filePath).replace(/\\/g, '/');
    summary[relPath] = {
        size: content.length,
        lines: content.split('\n').length,
        functions: [],
        endpoints: [],
        classes: [],
        models: [],
        exports: []
    };
    
    // Quick regex scan
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
        let text = lines[i].trim();
        // Skip common false positives
        if (text.startsWith('//') || text.startsWith('/*')) continue;
        
        if (text.startsWith('class ')) {
            summary[relPath].classes.push(text);
        }
        else if (text.match(/(function |const .* = \(.*\) =>|const .* = async \(.*\) =>)/)) {
           // only capture named functions roughly
           let match = text.match(/function\s+([a-zA-Z0-9_]+)/);
           if (match) summary[relPath].functions.push(match[1]);
           else {
               match = text.match(/const\s+([a-zA-Z0-9_]+)\s*=/);
               if (match) summary[relPath].functions.push(match[1]);
           }
        }
        
        if (text.match(/router\.(get|post|put|patch|delete)\(/)) {
            summary[relPath].endpoints.push(text);
        }
        if (text.includes('mongoose.Schema')) {
            summary[relPath].models.push('Schema definition');
        }
        if (text.startsWith('export ') || text.startsWith('module.exports')) {
            summary[relPath].exports.push(text);
        }
    }
}

frontendFiles.forEach(analyzeFile);
backendFiles.forEach(analyzeFile);

fs.writeFileSync(path.join(root, 'tmp_analysis.json'), JSON.stringify(summary, null, 2));
console.log('Analysis complete. Output written to tmp_analysis.json.');
