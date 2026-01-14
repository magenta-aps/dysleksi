# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from django.views.i18n import JavaScriptCatalog
from two_factor.urls import urlpatterns as two_factor_urls

urlpatterns = [
    path("i18n/", include("django.conf.urls.i18n")),
    path("jsi18n/", JavaScriptCatalog.as_view(), name="javascript-catalog"),
    path("admin/", admin.site.urls),
    path(
        "",
        include(
            "dysleksi.urls",
            namespace="dysleksi",
        ),
    ),
    path(
        "",
        include(
            "login.urls",
            namespace="login",
        ),
    ),
    path("", include(two_factor_urls)),
]
if settings.MITID_TEST_ENABLED:  # type: ignore[misc]
    urlpatterns.append(
        path("mitid_test/", include("mitid_test.urls", namespace="mitid_test"))
    )

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
