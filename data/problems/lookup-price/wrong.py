def order_total(prices, items):
    total = 0
    for item in items:
        total += prices[item]
    return total
