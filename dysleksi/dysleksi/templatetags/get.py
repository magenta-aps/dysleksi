from django.template.defaultfilters import register


@register.filter
def get(item, attribute):
    try:
        if item is not None:
            if type(attribute) is str:
                if hasattr(item, attribute):
                    return getattr(item, attribute)
                if hasattr(item, "get"):
                    return item.get(attribute)
            if isinstance(item, (tuple, list)):
                return item[int(attribute)]
            if isinstance(item, dict):
                if str(attribute) in item:
                    return item[str(attribute)]
                return item[attribute]
    except (KeyError, TypeError, IndexError):
        pass
    return None
