# Dataset generation entry point
# The archive was generated deterministically with seed 20261116.
# See methodology.md for generation rules. This script re-runs validation after extraction.
import subprocess, sys, os
subprocess.run([sys.executable, os.path.join(os.path.dirname(__file__), 'validate_dataset.py')], check=True)
