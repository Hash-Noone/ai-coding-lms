def sum_evens(numbers):
    total = 0
    for n in numbers:
        if n % 2 == 1:
            total += n
    return total
