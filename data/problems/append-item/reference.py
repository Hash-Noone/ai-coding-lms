def add_item(item, items=None):
    result = [] if items is None else list(items)
    result.append(item)
    return result
