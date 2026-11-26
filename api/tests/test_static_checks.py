from app.static_checks import check_code


def test_reports_python_syntax_error():
    finding, = check_code("def solution(:\n")

    assert finding.source == "ast"
    assert finding.code == "syntax-error"
    assert finding.message
    assert finding.line == 1
    assert finding.column == 14


def test_reports_ruff_findings_without_running_code():
    finding, = check_code('raise RuntimeError("not executed")\nprint(unknown)\n')

    assert (finding.source, finding.code, finding.line, finding.column) == ("ruff", "F821", 2, 7)
    assert "unknown" in finding.message


def test_clean_solution_has_no_findings():
    assert check_code("def add(x, y):\n    return x + y\n") == []
