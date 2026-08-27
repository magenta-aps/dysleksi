# SPDX-FileCopyrightText: 2026 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0
from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models
from django.db.models import TextChoices


class LoginResult(TextChoices):
    SUCCESS = "success", "Succes"
    FAILURE = "failure", "Fejl"


class LoginAttempt(models.Model):
    """One login attempt, successful or not."""

    class Meta:
        ordering = ["-timestamp"]
        verbose_name = "Loginforsøg"
        verbose_name_plural = "Loginforsøg"

    timestamp = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name="Tidspunkt",
    )
    # The user, when we can identify one. `username` is always filled in, also
    # when the login failed because no such user exists, so the attempt can be
    # traced even after the user has been deleted.
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        verbose_name="Bruger",
    )
    username = models.CharField(
        max_length=255,
        blank=True,
        db_index=True,
        verbose_name="Brugernavn",
    )
    result = models.CharField(
        max_length=8,
        choices=LoginResult,
        db_index=True,
        verbose_name="Resultat",
    )
    # Which authentication backend handled the attempt, e.g. UniLogin/OIDC or
    # username+password
    backend = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Loginmetode",
    )
    ip_address = models.GenericIPAddressField(
        blank=True,
        null=True,
        verbose_name="IP-adresse",
    )

    def __str__(self) -> str:
        return f"{self.timestamp}: {self.username} ({self.result})"


class PageView(models.Model):
    """One access to a page that displays sensitive personal data."""

    class Meta:
        ordering = ["-timestamp"]
        verbose_name = "Dataopslag"
        verbose_name_plural = "Dataopslag"

    timestamp = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        verbose_name="Tidspunkt",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        blank=True,
        null=True,
        verbose_name="Bruger",
    )
    # Kept alongside the foreign key, so the log still identifies the user
    # after the user has been deleted
    username = models.CharField(
        max_length=255,
        db_index=True,
        verbose_name="Brugernavn",
    )
    url = models.CharField(
        max_length=1024,
        verbose_name="URL",
    )
    class_name = models.CharField(
        max_length=100,
        db_index=True,
        verbose_name="View",
    )
    kwargs = models.JSONField(
        default=dict,
        verbose_name="URL-parametre",
    )
    params = models.JSONField(
        default=dict,
        verbose_name="Forespørgselsparametre",
    )

    def __str__(self) -> str:
        return f"{self.timestamp}: {self.username} -> {self.url}"


class ItemView(models.Model):
    """One object whose data was displayed by a `PageView`."""

    class Meta:
        verbose_name = "Tilgået objekt"
        verbose_name_plural = "Tilgåede objekter"

    pageview = models.ForeignKey(
        PageView,
        on_delete=models.CASCADE,
        related_name="items",
    )
    content_type = models.ForeignKey(
        ContentType,
        on_delete=models.CASCADE,
        verbose_name="Datatype",
    )
    object_id = models.PositiveBigIntegerField(
        db_index=True,
        verbose_name="Objekt-id",
    )
    item = GenericForeignKey("content_type", "object_id")
    # `str(item)` as it looked when it was accessed, so the log remains
    # readable after the object has been changed or deleted
    item_label = models.CharField(
        max_length=255,
        verbose_name="Objekt",
    )

    def __str__(self) -> str:
        return f"{self.content_type}: {self.item_label}"
