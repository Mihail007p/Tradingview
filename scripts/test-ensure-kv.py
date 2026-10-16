"""Offline regression tests: python3 scripts/test-ensure-kv.py."""
import json
import os
from pathlib import Path
import subprocess
import tempfile

SCRIPT = Path(__file__).resolve().with_name('ensure-kv.sh')
ID = '0123456789abcdef0123456789abcdef'

def response(result, success=True):
    return json.dumps(dict(result=result, success=success, errors=[], messages=[]))

hit = response([dict(title='chart-analyst-bot-JOURNAL', id=ID)])
empty = response([])
created = response(dict(id=ID))
error = response(dict(id=ID), False)
for name, listing, creation, manual, code in [
    ('existing', hit, error, False, 0),
    ('create', empty, created, False, 0),
    ('denied', error, error, False, 1),
    ('manual', hit, error, True, 0),
    ('network', '', '', False, 1),
    ('malformed', 'not JSON', 'not JSON', False, 1),
]:
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory)
        mock = root / 'curl'
        mock.write_text('#!/usr/bin/env python3\nimport os,sys\nprint(os.environ["CREATE" if "POST" in sys.argv else "LIST"])\n')
        mock.chmod(0o755)
        config = root / 'wrangler.toml'
        original = '# binding = "JOURNAL"\n'
        if manual:
            original += f'[[kv_namespaces]]\nbinding = "JOURNAL"\nid = "{ID}"\n'
        config.write_text(original)
        env = dict(os.environ, PATH=str(root)+':'+os.environ['PATH'], LIST=listing,
                   CREATE=creation, CLOUDFLARE_API_TOKEN='test', CLOUDFLARE_ACCOUNT_ID='test',
                   GITHUB_OUTPUT=str(root / 'output'))
        for _ in range(2):
            result = subprocess.run(['bash', str(SCRIPT)], cwd=root, env=env, capture_output=True, text=True)
            assert result.returncode == code, (name, result.stderr)
            if code or manual:
                assert config.read_text() == original, name
            else:
                assert config.read_text().count('[[kv_namespaces]]') == 1, name
                assert f'id = "{ID}"' in config.read_text(), name
        print('PASS:', name)
