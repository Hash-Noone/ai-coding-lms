def largest(numbers):
    best = numbers[0]
    for n in numbers[1:]:
        if n > best:
            best = n
    return best
