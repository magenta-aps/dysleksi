# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from typing import Any
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse


def strtobool(val: str | bool, return_value_if_nonbool: bool = False) -> bool | str:
    if isinstance(val, bool):
        return val
    val = val.lower()
    if val in ("y", "yes", "t", "true", "on", "1"):
        return True
    elif val in ("n", "no", "f", "false", "off", "0"):
        return False
    else:
        if return_value_if_nonbool:
            return val
        raise ValueError("invalid truth value %r" % (val,))


def add_parameters_to_url(url: str, keys_to_add: dict) -> str:
    u = urlparse(url)
    query = parse_qs(u.query, keep_blank_values=True)
    for key, value in keys_to_add.items():
        query[key] = [str(value)]
    u = u._replace(query=urlencode(query, True))
    return urlunparse(u)


def omit(item: dict[str, Any], *keys: str) -> dict[str, Any]:
    return {key: value for key, value in item.items() if key not in keys}
