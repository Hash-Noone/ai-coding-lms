def nth_from_end(items, n):
    if 1 <= n <= len(items):
        return items[-n]
    return None
