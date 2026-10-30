# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
import os

PITU = {
    "certificate": os.environ.get("PITU_CLIENT_CERT"),
    "private_key": os.environ.get("PITU_CLIENT_CERT_KEY"),
    "root_ca": os.environ.get("PITU_SERVER_CERT"),
    "client_header": os.environ.get("PITU_UXP_CLIENT"),
    "base_url": os.environ.get("PITU_URL"),
    "cpr_lookup_service": os.environ.get(
        "PITU_CPR_LOOKUP_SERVICE",
        "PITU/GOV/DIA/magenta_services/DAFO-COMBINED/1",
    ),
    "name_lookup_service": os.environ.get(
        "PITU_NAME_LOOKUP_SERVICE",
        "PITU/GOV/DIA/magenta_services/DAFO-CPR-GENERIC/1",
    ),
}
