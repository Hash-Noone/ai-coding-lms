def tally(amounts):
    def add(total, amount):
        total = total + amount

    total = 0
    for amount in amounts:
        total = add(total, amount)
    return total
