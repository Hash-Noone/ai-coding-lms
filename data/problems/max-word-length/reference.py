def longest_word(sentence):
    longest = 0
    for word in sentence.split():
        longest = max(longest, len(word))
    return longest
