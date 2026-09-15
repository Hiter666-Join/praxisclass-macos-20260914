import { readFile, writeFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../lib/training/simulation-engine.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.CommonJS } }).outputText;
await writeFile(new URL('../resources/training/simulation-engine.js', import.meta.url), `// Generated from lib/training/simulation-engine.ts. Run npm run gen:training.\nwindow.TrainingSimulation = (() => { const exports = {};\n${js}\nreturn exports; })();\n`);
