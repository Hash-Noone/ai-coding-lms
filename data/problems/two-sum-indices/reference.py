def two_sum(numbers, target):
    seen = {}
    for j, n in enumerate(numbers):
        if target - n in seen:
            return [seen[target - n], j]
        seen[n] = j
    return []
