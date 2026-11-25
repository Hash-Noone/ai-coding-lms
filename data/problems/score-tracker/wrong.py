def longest_streak(events):
    best = current = 0
    for event in events:
        if event == 'win':
            current += 1
            best = max(best, current)
    return best
