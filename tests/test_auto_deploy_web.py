from contextlib import ExitStack
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('auto_web', Path(__file__).parents[1] / 'scripts/auto-deploy-web.py')
web = importlib.util.module_from_spec(spec)
spec.loader.exec_module(web)


class AutoDeployWebTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.state = Path(self.directory.name)
        self.repo = self.state / 'repo'
        self.repo.mkdir()
        self.dev = {'branch': 'dev', 'commit': 'a' * 40}
        self.main = {'branch': 'main', 'commit': 'b' * 40}
        self.commands = []

    def command(self, args, **kwargs):
        self.commands.append(args)
        if args[:2] == ['git', 'archive']:
            Path(args[args.index('--output') + 1]).touch()

    def patches(self, selected=None):
        stack = ExitStack()
        stack.enter_context(patch.object(web, 'target', return_value=selected or self.dev))
        stack.enter_context(patch.object(web, 'running_image', return_value='sha256:old'))
        stack.enter_context(patch.object(web, 'run', return_value='sha256:new'))
        stack.enter_context(patch.object(web.subprocess, 'check_call', side_effect=self.command))
        stack.enter_context(patch.object(web.time, 'sleep'))
        stack.enter_context(patch.object(web, 'wait_for_web'))
        return stack

    def test_build_receives_branch_and_publishes_only_web(self):
        with self.patches():
            web.deploy(self.repo, self.state)
        build = next(c for c in self.commands if c[:2] == ['docker', 'build'])
        self.assertIn('APP_GIT_BRANCH=dev', build)
        archive = next(c for c in self.commands if c[:2] == ['git', 'archive'])
        self.assertIn(self.dev['commit'], archive)
        self.assertNotIn('.env', archive)
        compose = next(c for c in self.commands if c[:2] == ['docker', 'compose'])
        self.assertEqual(compose[-5:], ['up', '-d', '--no-deps', '--no-build', 'web'])
        state = json.loads((self.state / 'deployed.json').read_text())
        self.assertEqual(state, {'target': self.dev, 'image': 'sha256:new'})

    def test_branch_change_during_build_does_not_publish_stale_image(self):
        with self.patches(), patch.object(web, 'target', side_effect=[self.dev, self.dev, self.main]):
            web.deploy(self.repo, self.state)
        self.assertFalse(any(c[:3] == ['docker', 'image', 'tag'] for c in self.commands))
        self.assertFalse((self.state / 'deployed.json').exists())

    def test_already_published_target_does_not_build_again(self):
        web.write_state(self.state / 'deployed.json', {'target': self.dev, 'image': 'sha256:old'})
        with self.patches():
            web.deploy(self.repo, self.state)
        self.assertEqual(self.commands, [])

    def test_switch_with_same_commit_still_rebuilds_for_main(self):
        same_commit = dict(self.dev, branch='main')
        web.write_state(self.state / 'deployed.json', {'target': self.dev, 'image': 'sha256:old'})
        with self.patches(same_commit):
            web.deploy(self.repo, self.state)
        self.assertTrue(any('APP_GIT_BRANCH=main' in c for c in self.commands))

    def test_failed_build_keeps_running_web_and_cools_down(self):
        original = self.command
        def failing(args, **kwargs):
            original(args, **kwargs)
            if args[:2] == ['docker', 'build']:
                raise subprocess.CalledProcessError(1, args)
        with self.patches(), patch.object(web.subprocess, 'check_call', side_effect=failing):
            with self.assertRaises(subprocess.CalledProcessError):
                web.deploy(self.repo, self.state)
        self.assertFalse(any(c[:2] == ['docker', 'compose'] for c in self.commands))
        self.commands.clear()
        with self.patches():
            web.deploy(self.repo, self.state)
        self.assertEqual(self.commands, [])

    def test_unhealthy_new_web_restores_previous_image(self):
        with self.patches(), patch.object(web, 'wait_for_web', side_effect=RuntimeError('Unavailable')):
            with self.assertRaises(RuntimeError):
                web.deploy(self.repo, self.state)
        tags = [c for c in self.commands if c[:3] == ['docker', 'image', 'tag']]
        self.assertEqual(tags[-1], ['docker', 'image', 'tag', 'sha256:old', 'espacio-to-web:latest'])
        self.assertEqual(sum(c[:2] == ['docker', 'compose'] for c in self.commands), 2)
        self.assertFalse((self.state / 'deployed.json').exists())


if __name__ == '__main__':
    unittest.main()
