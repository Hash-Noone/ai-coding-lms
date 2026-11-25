def average(scores):
    if not scores:
        return 0.0
    return round(sum(scores) / len(scores), 2)
