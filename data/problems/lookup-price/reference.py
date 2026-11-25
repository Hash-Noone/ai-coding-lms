def order_total(prices, items):
    total = 0
    for item in items:
        if item in prices:
            total += prices[item]
    return total
