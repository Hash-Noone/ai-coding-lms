import json
from pathlib import Path


def test_mistake_taxonomy_has_ten_distinct_categories():
    path = Path(__file__).resolve().parents[2] / "data/taxonomy.json"
    taxonomy = json.loads(path.read_text())
    assert isinstance(taxonomy["version"], int) and taxonomy["version"] >= 1
    assert len(taxonomy["mistake_types"]) == 10
    assert len({entry["id"] for entry in taxonomy["mistake_types"]}) == 10
