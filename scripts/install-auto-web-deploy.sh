#!/usr/bin/env bash
set -euo pipefail
if [[ $(uname -s) != Linux ]]; then
  printf 'Este instalador se ejecuta únicamente en el servidor Ubuntu.\n' >&2
  exit 1
fi
project_dir=$(git rev-parse --show-toplevel)
for program in python3 git docker systemctl loginctl; do command -v "$program" >/dev/null; done
install_dir="$HOME/.local/libexec/espacio-to"
state_dir="$HOME/.local/state/espacio-to-web-deploy"
unit_dir="$HOME/.config/systemd/user"
install -d -m 700 "$install_dir" "$state_dir" "$unit_dir"
# Install a stable copy: switching to an older main must not remove the watcher.
install -m 700 "$project_dir/scripts/auto-deploy-web.py" "$install_dir/auto-deploy-web.py"
python3 - "$project_dir" "$install_dir" "$state_dir" "$unit_dir" <<'PY'
from pathlib import Path
import sys
repo, install, state, units = sys.argv[1:]
def quote(value):
    return '"' + value.replace('\\', '\\\\').replace('"', '\\"').replace('%', '%%') + '"'
Path(units, 'espacio-to-web-branch.service').write_text(f'''[Unit]
Description=Actualizar la web de Espacio TO desde la rama seleccionada

[Service]
Type=oneshot
ExecStart=/usr/bin/python3 {quote(install + '/auto-deploy-web.py')} --repo {quote(repo)} --state-dir {quote(state)}
TimeoutStartSec=15min
UMask=0077
''')
Path(units, 'espacio-to-web-branch.timer').write_text('''[Unit]
Description=Detectar cambios de rama de Espacio TO

[Timer]
OnBootSec=15s
OnUnitInactiveSec=3s
AccuracySec=1s
Unit=espacio-to-web-branch.service

[Install]
WantedBy=timers.target
''')
PY
systemctl --user daemon-reload
systemctl --user enable --now espacio-to-web-branch.timer
systemctl --user start --no-block espacio-to-web-branch.service
printf 'Actualización automática instalada para %s.\n' "$project_dir"
printf 'Para mantenerla activa tras cerrar sesión: sudo loginctl enable-linger %s\n' "$(id -un)"
