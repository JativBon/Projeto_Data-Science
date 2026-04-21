from pathlib import Path
import runpy


runpy.run_path(str(Path(__file__).with_name("03_dataset.py")), run_name="__main__")
