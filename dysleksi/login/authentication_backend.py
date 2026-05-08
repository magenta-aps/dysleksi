from mozilla_django_oidc.auth import OIDCAuthenticationBackend

from dysleksi.models import User


class DysleksiOIDCAuthenticationBackend(OIDCAuthenticationBackend):
    def filter_users_by_claims(self, claims):
        uniid = claims.get("uniid")
        if not uniid:
            return self.UserModel.objects.none()
        try:
            user = User.objects.get(uniid=uniid)
            return [user]
        except User.DoesNotExist:
            return self.UserModel.objects.none()
