# Dysleksi

## Purpose and context

The Dysleksi project facilitates screening tests for dyslexia, and is intended for use in schools and other educational institutions in Greenland.

## Development

To start the project, clone/copy your repository of binary files into a neighbouring directory, such that the resulting filestructure is
```bash
dysleksi
`-- dysleksi/*
dysleksi-binaries
|-- dysleksi-binaries/dummy-data
`-- dysleksi-binaries/real-data
```

Then, `up` the docker containers using compose in the `dysleksi` directory:

```bash
docker compose up -d
```

## Usage hints

In your browser, go to https://dysleksi-web/ and log in using the teacher's credentials.
Now open a second browser in incognito mode, and go to https://dysleksi-web/ there as
well. Log in using the student's credentials:

| Method            | Teacher username   | Teacher password   | Student username | Student password |
|-------------------|--------------------|--------------------|------------------|------------------|
| Username/password | `lærer`            | `lærer`            | `elev`           | `elev`           |
| UniLogin/MitID    | `lærer@dys.gl`     | `lærer`            | `elev@dys.gl`    | `elev`           |


To begin a screening session, click "Start individueltest" in the teacher window. The "student window" should now automatically switch to a screening session.

## Accessing Django admin

In your browser, go to https://dysleksi-web/django-admin/, and log in using the credentials `admin/admin`.

The `admin` user is also a teacher, making it easy to edit data in the Django admin, and then trying out those changes in the teacher UI without switching users.

## Testing

To run the tests run
```shell
docker exec dysleksi-web bash -c 'coverage run manage.py test --parallel ; coverage combine ; coverage report --show-missing'
```

To run Javascript tests run the following command:
```
docker-compose run --rm dysleksi-js-tests
```

After running this, you will be able to see a detailed coverage overview at
http://localhost:8143/vitest_coverage/

To run tests only in a specific file run
```shell
docker exec dysleksi-web bash -c 'coverage run manage.py test dysleksi.tests.test_specific'
```

To run type checks run:

```shell
docker exec dysleksi-web mypy --config ../mypy.ini dysleksi/ --cache-dir=/dev/null
```

## Running a dev environment on an iPad
To run the application on an iPad, start an avahi-daemon on your host PC:

```
sudo apt install avahi-daemon
sudo systemctl enable --now avahi-daemon
```

This will broadcast your hostname on the local network. Find your hostname using the
following command:

```
hostname
```

Now configure docker-compose.override.yml as follows:

```
services:
  dysleksi-web:
    environment:
      - TEST=false
      - ALLOWED_HOSTS=["<hostname>.local","dysleksi-web","localhost","host.docker.internal"]
      - CSRF_TRUSTED_ORIGINS=["https://<hostname (lowercase)>.local","https://dysleksi-web"]
  dysleksi-traefik:
    environment:
      - HOSTNAME=<hostname (lowercase)>.local
```

Where `<hostname>` should be replaced by your machine's hostname, which you obtained
using the `hostname` command.

Now you can visit `https://<hostname>.local` on your ipad and log in with
`elev:elev`. You can also bookmark the URL and add it to your home screen. If
you decide to do so, make sure "open as web app" is disabled.

On your PC you can now log in with `lærer:lærer` and assign a test to the ipad
student (Steve Jobs, class 0.C)

## Technology

The project uses `django-channels` to synchronize events between teacher and student browser contexts.

`django-channels` provides backend support for writing a WebSocket server, and is used in two ways in the project:

* All teachers and students begin by entering a "lobby." This lets teachers know which students are present at their screens.
* To begin an individual screening session, a separate "room" is created for that particular session. In this "room", all session events are communicated between the teacher's and the student's browser. 

Messages in the lobby and in the session-specific rooms take the form `{"event": "some.event", "id": 1234}`.


## Keeping binaries up-to-date
For the best-possible experience, it is important that the dysleksi-binaries repo is
always up-to-date. You can automate this by writing a `post-merge` hook:

```
cd .git/hooks
touch post-merge
chmod +x post-merge
```

With the following contents:

```
#!/bin/bash

BINARIES_REPO="../dysleksi-binaries"

echo "--- Updating binaries repository ---"

# Check if the directory exists
if [ -d "$BINARIES_REPO" ]; then
    # Move to the binaries directory
    cd "$BINARIES_REPO" || exit

    # Checkout master
    git checkout master

    # Pull the latest changes
    git pull origin master
    
    echo "--- Binaries repository is now up to date ---"
else
    echo "Error: Directory $BINARIES_REPO not found."
fi
```

This will checkout master on your `dysleksi-binaries` repository and perform at git-pull
when you pull from the `dysleksi` repository. Now your dysleksi-binaries repository will
always be up-to-date.

## Dependencies
To find out where packages come from, you can run pipdeptree. For example:

```
docker exec -it dysleksi-web bash
pipdeptree --reverse --packages pyOpenSSL

>>> pyOpenSSL==24.2.1
>>> └── pysaml2==7.5.4 [requires: pyOpenSSL<24.3.0]
>>>     └── gl-mitid==1.9.1 [requires: pysaml2==7.5.4]
```
