def longest_word(sentence):
    for word in sentence.split():
        longest = 0
        longest = max(longest, len(word))
    return longest
