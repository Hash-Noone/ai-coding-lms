def first_unique(text):
    seen = set()
    for i, ch in enumerate(text):
        if ch not in seen:
            return i
        seen.add(ch)
    return -1
