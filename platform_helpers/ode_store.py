import json
import os
import tempfile
from pathlib import Path
from typing import Any

ODE_CONFIG_DIR = Path.home() / ".config" / "ode"
ODE_CONFIG_FILE = ODE_CONFIG_DIR / "ode.json"


def read_ode_config() -> dict[str, Any]:
    try:
        with open(ODE_CONFIG_FILE) as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def write_ode_config(config: dict[str, Any]) -> None:
    ODE_CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    fd, tmp_path = tempfile.mkstemp(dir=str(ODE_CONFIG_DIR), suffix=".tmp")
    try:
        with os.fdopen(fd, "w") as f:
            json.dump(config, f, indent=2, ensure_ascii=True)
            f.flush()
            os.fsync(fd)
        os.replace(tmp_path, str(ODE_CONFIG_FILE))
    except BaseException:
        os.unlink(tmp_path)
        raise
