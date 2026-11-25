def count_vowels(text):
    return sum(1 for ch in text if ch in 'aeiou')
