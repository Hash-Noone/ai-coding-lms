def capitalize_words(sentence):
    return ' '.join(word[0].upper() + word[1:].lower() for word in sentence.split(' '))
