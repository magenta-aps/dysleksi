# Dysleksi

## Purpose and context

The Dysleksi project facilitates screening tests for dyslexia, and is intended for use in schools and other educational institutions in Greenland.

## Development

To start the project, `up` the docker containers using compose:

```bash
docker compose up -d
```

## Usage hints

In your browser, go to https://dysleksi-web:8140/ and log in using the credentials `lærer/lærer`.

Now open a second browser in incognito mode, and go to https://dysleksi-web:8140/ there as well. Log in using the credentials `elev/elev`.

In the "teacher window", you should see a list of students (with only one student.)

To begin a screening session, click "Start individueltest" in the teacher window. The "student window" should now automatically switch to a screening session.

## Testing

To run the tests run
```shell
docker exec dysleksi-web bash -c 'coverage run manage.py test --parallel ; coverage combine ; coverage report --show-missing'
```

To run Javascript tests run the following command:
```
docker-compose run --rm dysleksi-js-tests
```

To run tests only in a specific file run
```shell
docker exec dysleksi-web bash -c 'coverage run manage.py test dysleksi.tests.test_specific'
```

To run type checks run:

```shell
docker exec dysleksi-web mypy --config ../mypy.ini dysleksi/
```

## Running a dev environment on an iPad
To run the application on an iPad, configure docker-compose.override.yml as
follows:

```
services:
  dysleksi-web:
    environment:
      - TEST=false
      - ALLOWED_HOSTS=["<ip address>","dysleksi-web","localhost","host.docker.internal"]
      - LOGIN_BYPASS_ENABLED=True
```

Where `<ip address>` should be replaced by your machine's ip-address.

Now you can visit `https://<ip address>:8140` on your ipad and log in with 
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

## Real data (wordreading 2)
To load some real wordreading 2 data into the system:

Add the zipped files from https://redmine.magenta.dk/documents/382 to 
`file-data/wordreading_2`

You can also run `extract_wordreading_2_images.py` from the `scripts` folder. This 
generates the same files.

Then run the following command to add the word-reading 2 subtest to the test named 
`Middle 2. grade`
```
docker exec dysleksi-web python manage.py import_test "Middle 2. grade" "/upload/wordreading_2/wordreading_2.json"
```