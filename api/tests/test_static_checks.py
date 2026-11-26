from app.static_checks import check_code


def test_reports_python_syntax_error():
    finding, *_ = check_code("def solution(:\n")

    assert finding.source == "ruff"
    assert finding.code == "invalid-syntax"
    assert finding.message
    assert finding.line == 1
    assert finding.column == 14


def test_reports_ruff_findings_without_running_code():
    finding, = check_code('raise RuntimeError("not executed")\nprint(unknown)\n')

    assert (finding.source, finding.code, finding.line, finding.column) == ("ruff", "F821", 2, 7)
    assert "unknown" in finding.message


def test_clean_solution_has_no_findings():
    assert check_code("def add(x, y):\n    return x + y\n") == []


def test_accepts_python_314_template_strings():
    assert check_code('message = t"Hello {1 + 2}"\n') == []


def test_reports_leading_bom_as_syntax_error():
    finding, = check_code("\ufeffdef add(x, y):\n    return x + y\n")

    assert finding.source == "ruff"
    assert finding.code == "invalid-syntax"
    assert "U+FEFF" in finding.message
    assert finding.line == 1
    assert finding.column == 1
