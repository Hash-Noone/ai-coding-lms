def capitalize_words(sentence):
    return ' '.join(word[:1].upper() + word[1:].lower() for word in sentence.split(' '))
