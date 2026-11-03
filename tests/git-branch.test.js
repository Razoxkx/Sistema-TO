import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { activeGitBranch } from '../vite.config.js';

test('la etiqueta sigue la rama Git, aunque el entorno diga desarrollo', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'espacio-branch-'));
  const git = (...args) => execFileSync('git', args, { cwd, stdio: 'pipe' });
  try {
    git('init', '--initial-branch=main');
    assert.equal(activeGitBranch(cwd, { NODE_ENV: 'development', APP_GIT_BRANCH: 'dev' }), 'main');
    git('switch', '-c', 'dev');
    assert.equal(activeGitBranch(cwd, { NODE_ENV: 'production' }), 'dev');
    git('-c', 'user.name=Prueba', '-c', 'user.email=test@example.invalid', 'commit', '--allow-empty', '-m', 'Fixture');
    git('switch', '--detach');
    assert.equal(activeGitBranch(cwd, { APP_GIT_BRANCH: 'dev' }), '');
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test('el contenedor sin Git usa la rama de compilación y no el modo de Vite', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'espacio-build-'));
  try {
    assert.equal(activeGitBranch(cwd, { NODE_ENV: 'development' }), '');
    assert.equal(activeGitBranch(cwd, { APP_GIT_BRANCH: 'main', NODE_ENV: 'development' }), 'main');
    assert.equal(activeGitBranch(cwd, { APP_GIT_BRANCH: 'dev', NODE_ENV: 'production' }), 'dev');
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
