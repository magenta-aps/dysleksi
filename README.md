# Dysleksi

## Development

To start the project, `up` the docker containers using compose:

```bash
docker compose up -d
```

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
