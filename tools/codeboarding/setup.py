#!/usr/bin/env python3
"""Install the pinned, unmodified CodeBoarding runtime used by Pi's /flow command."""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


UPSTREAM_URL = "https://github.com/CodeBoarding/CodeBoarding.git"
UPSTREAM_COMMIT = "b5341f2e2af2dd951a5bbe87cccee4c48eaf8bf8"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    agent_dir = Path(os.environ.get("PI_CODING_AGENT_DIR", str(Path.home() / ".pi" / "agent"))).expanduser()
    parser.add_argument("--install-dir", type=Path, default=agent_dir / "codeboarding")
    args = parser.parse_args()
    install_dir = args.install_dir.expanduser().resolve()
    git = shutil.which("git")
    uv = shutil.which("uv")
    if not git or not uv:
        parser.error("Install git and uv first (https://docs.astral.sh/uv/getting-started/installation/), then rerun")

    env = dict(os.environ)
    env.update(
        GIT_TERMINAL_PROMPT="0",
        CODEBOARDING_TELEMETRY="false",
        DO_NOT_TRACK="1",
        NPM_CONFIG_IGNORE_SCRIPTS="true",
    )
    checkout = install_dir / "upstream"
    install_dir.mkdir(parents=True, exist_ok=True)
    if checkout.exists():
        revision = subprocess.run(
            [git, "-C", str(checkout), "rev-parse", "HEAD"], capture_output=True, text=True, check=True, env=env
        ).stdout.strip()
        if revision != UPSTREAM_COMMIT:
            parser.error(f"{checkout} has a different revision; select a new --install-dir to preserve that checkout")
        subprocess.run([git, "-C", str(checkout), "diff", "--quiet", "HEAD"], check=True, env=env)
    else:
        subprocess.run([git, "init", str(checkout)], check=True, env=env)
        subprocess.run([git, "-C", str(checkout), "remote", "add", "origin", UPSTREAM_URL], check=True, env=env)
        subprocess.run(
            [git, "-C", str(checkout), "fetch", "--depth", "1", "origin", UPSTREAM_COMMIT], check=True, env=env
        )
        subprocess.run([git, "-C", str(checkout), "checkout", "--detach", "FETCH_HEAD"], check=True, env=env)

    subprocess.run([uv, "sync", "--frozen", "--no-dev", "--python", "3.12", "--project", str(checkout)], check=True, env=env)
    python = checkout / ".venv" / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
    # Upstream uses httpx without this optional dependency. Preserve proxy support rather than
    # changing a user's proxy configuration when an Ollama import constructs its httpx client.
    subprocess.run([uv, "pip", "install", "--python", str(python), "socksio==1.0.0"], check=True, env=env)
    bridge = install_dir / "bridge.py"
    shutil.copy2(Path(__file__).with_name("bridge.py"), bridge)
    subprocess.run([str(python), str(bridge), "--help"], check=True, env=env)
    (install_dir / "runtime.json").write_text(
        json.dumps({"upstream": UPSTREAM_URL, "commit": UPSTREAM_COMMIT, "python": str(python)}, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"\nInstalled CodeBoarding {UPSTREAM_COMMIT} in {install_dir}")
    print("Start Pi inside a repository and enter /flow static for local call analysis.")
    print("For architecture analysis, configure CodeBoarding's model provider, then enter /flow.")
    print(f"Runtime override, if needed: PI_CODEBOARDING_PYTHON={python}")


if __name__ == "__main__":
    main()
