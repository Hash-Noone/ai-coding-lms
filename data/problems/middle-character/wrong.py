def middle(word):
    mid = len(word) / 2
    if len(word) % 2 == 0:
        return word[mid - 1:mid + 1]
    return word[mid]
