# SPDX-FileCopyrightText: 2025 Magenta ApS <info@magenta.dk>
#
# SPDX-License-Identifier: MPL-2.0

FROM python:3.14

ENV SUPERCRONIC_URL=https://github.com/aptible/supercronic/releases/download/v0.2.27/supercronic-linux-amd64 \
    SUPERCRONIC=supercronic-linux-amd64 \
    SUPERCRONIC_SHA1SUM=7dadd4ac827e7bd60b386414dfefc898ae5b6c63\
    PYTHONUNBUFFERED=1

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

RUN mkdir /app && \
    mkdir -p /var/cache/idp && \
    mkdir -p /var/cache/dysleksi && \
    #gid/uid from salt
    groupadd -g 75190 -r dysleksi && \
    groupadd -g 75100 -r certificate_exporter && \
    useradd -u 75190 --no-log-init -r -g dysleksi -G certificate_exporter dysleksi && \
    chown -R dysleksi:dysleksi /var/cache/dysleksi && \
    chown -R dysleksi:dysleksi /var/cache/idp && \
    chmod a+w /var/cache/dysleksi

# supercronic
RUN curl -fsSLO "$SUPERCRONIC_URL" && \
    echo "${SUPERCRONIC_SHA1SUM}  ${SUPERCRONIC}" | sha1sum -c - && \
    chmod +x "$SUPERCRONIC" && \
    mv "$SUPERCRONIC" "/usr/local/bin/${SUPERCRONIC}" && \
    ln -s "/usr/local/bin/${SUPERCRONIC}" /usr/local/bin/supercronic

COPY ./docker/postgresql.gpg /etc/apt/trusted.gpg.d/postgresql.gpg
# hadolint ignore=DL3008
RUN sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" > /etc/apt/sources.list.d/pgdg.list' && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        gettext graphviz libxmlsec1-dev xmlsec1 libssl-dev libsasl2-dev postgresql-client-common postgresql-client-16 logrotate && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

COPY requirements.txt /app/requirements.txt
COPY mypy.ini /app/mypy.ini


RUN pip install --no-cache-dir -r /app/requirements.txt

ARG COMMIT_TAG
ENV COMMIT_TAG=${COMMIT_TAG:-HEAD}

COPY ./docker/entrypoint.sh /entrypoint.sh
COPY --chown=dysleksi:dysleksi ./dysleksi /app
RUN chown dysleksi:dysleksi /app
USER dysleksi
EXPOSE 8000
ENTRYPOINT ["/entrypoint.sh"]
WORKDIR /app
RUN django-admin compilemessages --locale=da --locale=kl --verbosity=1

VOLUME /var/cache/idp

CMD ["gunicorn","--bind","0.0.0.0:8000","project.asgi:application","-w","4","-k","uvicorn.workers.UvicornWorker","--timeout","120","--error-logfile","-","--capture-output"]
