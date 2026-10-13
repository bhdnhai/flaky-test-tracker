import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** Creates a Project through the real Operator CLI, exactly as the ticket's hand-check does. */
export async function createProject(name: string): Promise<string> {
  const { stdout } = await execFileAsync('docker', [
    'compose',
    'exec',
    '-T',
    'api',
    'node',
    'dist/cli.js',
    'create-project',
    name,
  ]);
  const token = stdout.trim().split('\n').pop();
  if (!token) throw new Error(`create-project ${name} printed no token`);
  return token;
}
