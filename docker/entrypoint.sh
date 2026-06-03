#!/bin/bash

# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

set -e
MAKE_MIGRATIONS=${MAKE_MIGRATIONS:=false}
MIGRATE=${MIGRATE:=false}
TEST=${TEST:=false}
MAKEMESSAGES=${MAKEMESSAGES:=false}
PULL_IDP_METADATA=${PULL_IDP_METADATA:=false}
CREATE_DUMMY_DATA=${CREATE_DUMMY_DATA:=false}
CREATE_DUMMY_USERS=${CREATE_DUMMY_USERS:=false}
STATICFILES_DESTINATION_DIR=${STATICFILES_DESTINATION_DIR:=""}

python manage.py wait_for_db

if [ "${MAKE_MIGRATIONS,,}" = true ]; then
  echo 'generating migrations'
  python manage.py makemigrations --no-input
fi

if [ "${MIGRATE,,}" = true ]; then
  echo 'running migrations'
  python manage.py migrate
fi

echo 'creating groups'
python manage.py create_groups

if [ "${CREATE_DUMMY_DATA,,}" = true ]; then
  python manage.py create_dummy_classes_and_users
  python manage.py create_tests --dummy --answer &
  python manage.py create_tests --answer &
fi

echo 'creating cache table'
python manage.py createcachetable

echo 'ensuring result categories'
python manage.py create_result_categories

if [ "${PULL_IDP_METADATA,,}" = true ]; then
  echo "Updating metadata"
  python manage.py update_mitid_idp_metadata
fi

if [ "${MAKEMESSAGES,,}" = true ]; then
  echo 'making messages'
  python manage.py extendedmakemessages --locale=kl --locale=da --keep-header --no-obsolete --add-location file
  python manage.py extendedmakemessages --locale=kl --locale=da --keep-header --no-obsolete --add-location file --domain djangojs
  python manage.py compilemessages --locale=da --locale=kl --verbosity=2
fi

if [ "${TEST,,}" = true ]; then
  echo 'running tests'
  coverage run manage.py test
  coverage combine
  coverage report --show-missing
fi

if [ $ECHO_INTERFACE ]; then
  echo "Interface: $ECHO_INTERFACE"
fi

if [ -d $STATICFILES_DESTINATION_DIR ]; then
  echo "Copying static files from image to volume"
  # So that the dysleksi-static-web container can serve them
  cp -r /static/* $STATICFILES_DESTINATION_DIR
fi


exec "$@"
