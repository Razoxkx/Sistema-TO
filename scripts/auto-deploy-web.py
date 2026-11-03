#!/usr/bin/env python3
"""Publish the committed main/dev checkout; run once from a systemd timer."""
import argparse
import fcntl
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import urllib.request


def run(args, cwd=None):
    return subprocess.check_output(args, cwd=cwd, text=True).strip()


def target(repo):
    branch = run(['git', 'branch', '--show-current'], repo)
    if branch not in ('main', 'dev'):
        return None
    # Never publish an in-progress checkout or uncommitted source edits.
    if subprocess.call(['git', 'diff', '--quiet', 'HEAD', '--'], cwd=repo):
        return None
    return {'branch': branch, 'commit': run(['git', 'rev-parse', 'HEAD'], repo)}


def running_image():
    return run(['docker', 'inspect', '--format', '{{.Image}}', 'espacio-to-web-1'])


def read_state(path):
    try:
        return json.loads(path.read_text())
    except (OSError, ValueError):
        return {}


def write_state(path, value):
    temporary = path.with_suffix('.tmp')
    temporary.write_text(json.dumps(value) + '\n')
    temporary.chmod(0o600)
    temporary.replace(path)


def compose_web(repo):
    subprocess.check_call([
        'docker', 'compose', '--project-name', 'espacio-to',
        '-f', str(repo / 'compose.server.yaml'),
        'up', '-d', '--no-deps', '--no-build', 'web',
    ], cwd=repo)


def wait_for_web():
    for attempt in range(15):
        try:
            with urllib.request.urlopen('http://127.0.0.1:5173/', timeout=3) as response:
                if response.status == 200:
                    return
        except OSError:
            pass
        time.sleep(1)
    raise RuntimeError('La nueva web no respondió en el puerto 5173.')


def deploy(repo, state_dir):
    selected = target(repo)
    if not selected:
        return
    state_file = state_dir / 'deployed.json'
    failure_file = state_dir / 'failure.json'
    previous = read_state(state_file)
    if previous.get('target') == selected and previous.get('image') == running_image():
        return
    failed = read_state(failure_file)
    if failed.get('target') == selected and time.time() - failed.get('time', 0) < 60:
        return

    # Let an atomic Git checkout finish before taking its snapshot.
    time.sleep(0.5)
    if target(repo) != selected:
        return
    print(f"Compilando {selected['branch']} ({selected['commit'][:8]})…", flush=True)
    try:
        with tempfile.TemporaryDirectory(prefix='build-', dir=state_dir) as directory:
            snapshot = Path(directory)
            archive = snapshot / 'source.tar'
            subprocess.check_call([
                'git', 'archive', '--format=tar', '--output', str(archive),
                selected['commit'], '--', 'Dockerfile', 'package.json',
                'package-lock.json', 'index.html', 'vite.config.js', 'nginx.conf',
                'src', 'shared', 'public',
            ], cwd=repo)
            subprocess.check_call(['tar', '-xf', str(archive), '-C', str(snapshot)])
            archive.unlink()
            image_tag = 'espacio-to-web:auto-' + selected['branch']
            subprocess.check_call([
                'docker', 'build', '--target', 'web', '--build-arg',
                'APP_GIT_BRANCH=' + selected['branch'], '-t', image_tag, str(snapshot),
            ])

        # A second branch change during compilation must not publish stale code.
        if target(repo) != selected:
            print('La rama cambió durante la compilación; se revisará de nuevo.', flush=True)
            return
        image = run(['docker', 'image', 'inspect', '--format', '{{.Id}}', image_tag])
        old_image = running_image()
        subprocess.check_call(['docker', 'image', 'tag', old_image, 'espacio-to-web:before-auto'])
        subprocess.check_call(['docker', 'image', 'tag', image, 'espacio-to-web:latest'])
        try:
            compose_web(repo)
            wait_for_web()
        except Exception:
            subprocess.check_call(['docker', 'image', 'tag', old_image, 'espacio-to-web:latest'])
            compose_web(repo)
            raise
        write_state(state_file, {'target': selected, 'image': image})
        failure_file.unlink(missing_ok=True)
        print(f"Publicada la rama {selected['branch']} ({selected['commit'][:8]}).", flush=True)
    except Exception:
        write_state(failure_file, {'target': selected, 'time': time.time()})
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--repo', required=True, type=Path)
    parser.add_argument('--state-dir', required=True, type=Path)
    args = parser.parse_args()
    os.umask(0o077)
    args.state_dir.mkdir(parents=True, exist_ok=True)
    with (args.state_dir / 'deploy.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            return
        deploy(args.repo.resolve(), args.state_dir.resolve())


if __name__ == '__main__':
    main()
