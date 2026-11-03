import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import { watch } from 'node:fs';
import path from 'node:path';

export function activeGitBranch(cwd = process.cwd(), env = process.env) {
  try {
    return execFileSync('git', ['symbolic-ref', '--quiet', '--short', 'HEAD'], { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (error) {
    // A detached checkout has no active branch. Docker has no .git directory;
    // deployment supplies the branch recorded by Git on the build host.
    if (error.status === 1) return '';
    return (env.APP_GIT_BRANCH || '').trim();
  }
}

function gitBranchPlugin() {
  const id = '\0virtual:app-branch';
  let root = process.cwd();
  return {
    name: 'espacio-git-branch',
    configResolved(config) { root = config.root; },
    resolveId(source) { if (source === 'virtual:app-branch') return id; },
    load(source) {
      if (source !== id) return;
      const branch = activeGitBranch(root);
      return `export const gitBranch = ${JSON.stringify(branch)}; export const isDevBranch = ${branch === 'dev'};`;
    },
    configureServer(server) {
      let previous = activeGitBranch(root);
      let timer;
      try {
        const head = path.resolve(root, execFileSync('git', ['rev-parse', '--git-path', 'HEAD'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim());
        // Watch the directory because Git replaces HEAD atomically on switch.
        const watcher = watch(path.dirname(head), (_event, filename) => {
          if (filename && filename.toString() !== path.basename(head)) return;
          clearTimeout(timer);
          timer = setTimeout(() => {
            const branch = activeGitBranch(root);
            if (branch === previous) return;
            previous = branch;
            const module = server.moduleGraph.getModuleById(id);
            if (module) server.moduleGraph.invalidateModule(module);
            server.ws.send({ type: 'full-reload' });
          }, 80);
        });
        server.httpServer?.once('close', () => { clearTimeout(timer); watcher.close(); });
      } catch { /* Archives without Git metadata use the supplied build branch. */ }
    },
  };
}
export default defineConfig({
  plugins: [react(), gitBranchPlugin()],
  server: { port: 5173, strictPort: true, headers: { 'Cross-Origin-Opener-Policy': 'same-origin-allow-popups', 'Referrer-Policy': 'no-referrer-when-downgrade' }, proxy: { '/api': 'http://127.0.0.1:3001' } },
});
