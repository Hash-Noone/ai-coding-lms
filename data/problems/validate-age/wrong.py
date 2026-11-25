def validated_age(text):
    try:
        age = int(text)
    except ValueError:
        return None
    if not 0 <= age <= 150:
        return False
    return age
