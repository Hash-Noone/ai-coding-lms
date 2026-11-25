def running_total(numbers):
    result = []
    for n in numbers:
        total = 0
        total += n
        result.append(total)
    return result
