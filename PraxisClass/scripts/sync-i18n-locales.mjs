import fs from 'node:fs';
import path from 'node:path';

const localesDirectory = path.join(process.cwd(), 'lib', 'i18n', 'locales');
const sourceFile = 'en-US.json';
const excludedFiles = new Set([sourceFile, 'zh-CN.json']);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function countLeaves(value) {
  if (!isPlainObject(value)) return 1;
  return Object.values(value).reduce((count, child) => count + countLeaves(child), 0);
}

function clone(value) {
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, clone(child)]));
}

function syncValue(source, target, stats) {
  if (!isPlainObject(source)) {
    if (isPlainObject(target)) {
      stats.removed += countLeaves(target);
      stats.added += 1;
      return source;
    }
    return target;
  }

  if (!isPlainObject(target)) {
    if (target !== undefined) stats.removed += 1;
    stats.added += countLeaves(source);
    return clone(source);
  }

  const result = {};
  for (const [key, child] of Object.entries(source)) {
    if (!Object.hasOwn(target, key)) {
      stats.added += countLeaves(child);
      result[key] = clone(child);
    } else {
      result[key] = syncValue(child, target[key], stats);
    }
  }
  for (const [key, child] of Object.entries(target)) {
    if (!Object.hasOwn(source, key)) stats.removed += countLeaves(child);
  }
  return result;
}

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(localesDirectory, fileName), 'utf8'));
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const source = readJson(sourceFile);
  const localeFiles = fs
    .readdirSync(localesDirectory)
    .filter((fileName) => fileName.endsWith('.json') && !excludedFiles.has(fileName))
    .sort();

  for (const fileName of localeFiles) {
    const stats = { added: 0, removed: 0 };
    const synced = syncValue(source, readJson(fileName), stats);
    if (!dryRun) {
      fs.writeFileSync(
        path.join(localesDirectory, fileName),
        `${JSON.stringify(synced, null, 2)}\n`,
        'utf8',
      );
    }
    console.log(`${fileName}: added ${stats.added} / removed ${stats.removed}`);
  }
}

main();
