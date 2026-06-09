import logging
from urllib.parse import urlencode

from django.conf import settings
from mozilla_django_oidc.auth import OIDCAuthenticationBackend

from dysleksi.models import User

if settings.TESTLOGGING:  # type: ignore
    logger = logging.getLogger(__name__)  # pragma: no cover

# TODO: Override store_tokens-method, to also save refresh token.


class DysleksiOIDCAuthenticationBackend(OIDCAuthenticationBackend):
    def get_userinfo(self, access_token, id_token, payload):
        userinfo_json = super().get_userinfo(access_token, id_token, payload)
        key = settings.OIDC_RP_IDP_SIGN_KEY
        if key is None:
            key = self.retrieve_matching_jwk(id_token)
        id_token_claims = self.get_payload_data(id_token, key)
        userinfo_json.update(id_token_claims)
        return userinfo_json

    def filter_users_by_claims(self, claims):
        uniid = claims.get("uniid")
        if settings.TESTLOGGING:  # type: ignore
            logger.info(f"RECEIVED CLAIMS: {claims}")  # pragma: no cover
        if not uniid:
            return self.UserModel.objects.none()
        try:
            user = User.objects.get(uniid=uniid)
            return [user]
        except User.DoesNotExist:
            return self.UserModel.objects.none()

    def verify_claims(self, claims):
        # Custom claims verification, due to
        # mozilla-django-oidc.readthedocs.io/en/stable/settings.html#OIDC_RP_SCOPES
        # More specific validation will be implemented
        return True


def unilogin_logout(request):
    kwargs = {
        "post_logout_redirect_uri": settings.HOST_DOMAIN + settings.LOGOUT_REDIRECT_URL,
        "id_token_hint": request.session.get("oidc_id_token"),
    }
    return settings.OIDC_OP_LOGOUT_URL + "?" + urlencode(kwargs)
