def two_sum(numbers, target):
    seen = {}
    for j, n in enumerate(numbers):
        seen[n] = j
        if target - n in seen:
            return [seen[target - n], j]
    return []
