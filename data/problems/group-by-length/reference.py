def group_by_length(words):
    groups = {}
    for word in words:
        groups.setdefault(str(len(word)), []).append(word)
    return groups
