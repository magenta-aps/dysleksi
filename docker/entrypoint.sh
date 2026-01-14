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
COLLECT_STATIC=${COLLECT_STATIC:=true}
CREATE_DUMMY_DATA=${CREATE_DUMMY_DATA:=false}
CREATE_DUMMY_USERS=${CREATE_DUMMY_USERS:=false}

python manage.py wait_for_db

if [ "${COLLECT_STATIC,,}" = true ]; then
  python manage.py collectstatic --no-input --clear --verbosity=0
  python manage.py compress --force --verbosity=1
fi

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

if [ "${CREATE_DUMMY_USERS,,}" = true ]; then
  echo 'creating test users'
  # "0111111111" er brugerens cpr og username
  # dev-idp godkender ud fra username som står i authsources
  python manage.py create_user 0111111111 elev --cpr 0111111111 -g Elever
  python manage.py create_user 0222222222 lærer --cpr 0222222222 -g Lærere
  python manage.py create_user admin admin --is_superuser
fi


if [ "${CREATE_DUMMY_DATA,,}" = true ]; then
  python manage.py create_dummy_classes
  python manage.py create_dummy_tests
fi

echo 'creating cache table'
python manage.py createcachetable

if [ "${PULL_IDP_METADATA,,}" = true ]; then
  echo "Updating metadata"
  python manage.py update_mitid_idp_metadata
fi

if [ "${MAKE_MESSAGES,,}" = true ]; then
  echo 'making messages'
  python manage.py makemessages --locale=kl --locale=da --no-obsolete --add-location file
  python manage.py makemessages --locale=kl --locale=da --no-obsolete --add-location file --domain djangojs
  python manage.py compilemessages --locale=da --locale=kl --verbosity=2
fi

if [ "${TEST,,}" = true ]; then
  echo 'running tests'
  coverage run manage.py test
  coverage combine
  coverage report --show-missing
fi

exec "$@"
