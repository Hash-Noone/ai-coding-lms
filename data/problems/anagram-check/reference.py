def is_anagram(a, b):
    def letters(s):
        counts = {}
        for ch in s.lower():
            if ch != ' ':
                counts[ch] = counts.get(ch, 0) + 1
        return counts
    return letters(a) == letters(b)
