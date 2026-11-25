def swap_pairs(items):
    result = list(items)
    for i in range(0, len(result) - 1, 2):
        result[i], result[i + 1] = result[i + 1], result[i]
    return result
