def word_counts(text):
    counts = {}
    for word in text.lower().split():
        counts[word] += 1
    return counts
