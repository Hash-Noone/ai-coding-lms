def group_by_length(words):
    groups = {}
    for word in words:
        groups[str(len(word))] = [word]
    return groups
