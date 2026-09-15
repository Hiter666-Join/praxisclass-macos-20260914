import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { getPlatformClient } from './client';

/** One coherent platform snapshot per UTC date. Only platform data and memories are copied. */
export async function backupPlatformData(now = new Date()): Promise<string> {
  const directory = path.resolve(process.env.PLATFORM_DATA_DIR ?? path.join(process.cwd(), 'data'));
  const root = path.join(directory, 'backup');
  const day = now.toISOString().slice(0, 10);
  const destination = path.join(root, day);
  const exists = await fs.stat(path.join(destination, 'snapshot.json')).then(
    () => true,
    () => false,
  );
  if (exists) return destination;

  await fs.mkdir(root, { recursive: true });
  const pending = path.join(root, `.pending-${randomUUID()}`);
  await fs.mkdir(pending);
  try {
    const client = await getPlatformClient();
    if (client.driver === 'sqlite') {
      // VACUUM INTO includes committed WAL pages; copying the live .db alone does not.
      const databasePath = path.join(pending, 'platform.db').replace(/'/g, "''");
      client.database.exec(`VACUUM INTO '${databasePath}'`);
    } else {
      await copyIfPresent(client.directory, path.join(pending, 'platform'));
    }
    await copyIfPresent(path.join(directory, 'memory'), path.join(pending, 'memory'));
    await fs.writeFile(
      path.join(pending, 'snapshot.json'),
      JSON.stringify(
        {
          createdAt: now.toISOString(),
          driver: client.driver,
          formatVersion: 1,
          includes: ['platform', 'memory'],
        },
        null,
        2,
      ) + '\n',
    );
    await fs.rename(pending, destination);
    return destination;
  } catch (error) {
    await fs.rm(pending, { recursive: true, force: true });
    throw error;
  }
}

async function copyIfPresent(source: string, destination: string): Promise<void> {
  try {
    await fs.stat(source);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    return;
  }
  await fs.cp(source, destination, { recursive: true, errorOnExist: true });
}
