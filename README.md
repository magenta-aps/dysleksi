# Dysleksi

## Purpose and context

The Dysleksi project facilitates screening tests for dyslexia, and is intended for use in schools and other educational institutions in Greenland.

## Development

To start the project, `up` the docker containers using compose:

```bash
docker compose up -d
```

## Usage hints

In your browser, go to http://dysleksi-web:8140/ and log in using the credentials `teacher/teacher`.

Now open a second browser in incognito mode, and go to http://dysleksi-web:8140/ there as well. Log in using the credentials `student/student`.

In the "teacher window", you should see a list of students (with only one student.)

To begin a screening session, click "Start individueltest" in the teacher window. The "student window" should now automatically switch to a screening session.

## Testing

To run the tests run
```shell
docker exec dysleksi-web bash -c 'coverage run manage.py test --parallel ; coverage combine ; coverage report --show-missing'
```

To run tests only in a specific file run
```shell
docker exec dysleksi-web bash -c 'coverage run manage.py test dysleksi.tests.test_specific'
```

To run type checks run:

```shell
docker exec dysleksi-web mypy --config ../mypy.ini dysleksi/
```

## Technology

The project uses `django-channels` to synchronize events between teacher and student browser contexts.

`django-channels` provides backend support for writing a WebSocket server, and is used in two ways in the project:

* All teachers and students begin by entering a "lobby." This lets teachers know which students are present at their screens.
* To begin an individual screening session, a separate "room" is created for that particular session. In this "room", all session events are communicated between the teacher's and the student's browser. 

Messages in the lobby and in the session-specific rooms take the form `{"event": "some.event", "id": 1234}`.
