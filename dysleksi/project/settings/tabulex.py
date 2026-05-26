import os
from typing import Any, Dict

from project.util import strtobool

TABULEX: Dict[str, Any] = {
    "mock": strtobool(os.environ["TABULEX_MOCK"]),
    "wsdl": os.environ.get("TABULEX_WSDL"),
    "auth": {},
    "dummy_data": os.environ.get("TABULEX_DUMMY_DATA", "/data/tabulex/test.json"),
    "client_cert": (
        os.environ.get("TABULEX_CLIENT_CERT"),
        os.environ.get("TABULEX_CLIENT_KEY"),
    ),
    "system_id": os.environ.get("TABULEX_SYSTEM_ID"),
    "institution_list": os.environ.get(
        "TABULEX_INSTITUTION_LIST", "/data/tabulex/inst.json"
    ),
}
