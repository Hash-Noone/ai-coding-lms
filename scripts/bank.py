"""Shared loaders for the versioned data in data/."""

import json
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[1] / "data"


def load_concepts(data_dir: Path = DATA_DIR) -> set[str]:
    return {concept["slug"] for concept in json.loads((data_dir / "concepts.json").read_text())}


def load_mistake_types(data_dir: Path = DATA_DIR) -> set[str]:
    taxonomy = json.loads((data_dir / "taxonomy.json").read_text())
    return {entry["id"] for entry in taxonomy["mistake_types"]}
