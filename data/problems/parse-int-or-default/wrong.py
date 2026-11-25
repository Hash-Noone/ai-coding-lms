def parse_int(text, default):
    if text.isdigit():
        return int(text)
    return default
