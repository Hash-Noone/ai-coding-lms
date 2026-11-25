def times_table(n):
    row = []
    table = []
    for i in range(n):
        for j in range(n):
            row.append((i + 1) * (j + 1))
        table.append(row)
    return table
