def is_anagram(a, b):
    return set(a.lower().replace(' ', '')) == set(b.lower().replace(' ', ''))
