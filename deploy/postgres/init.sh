#!/bin/sh
# Runs once, on the first start of an empty data volume.
# One database and one least-privilege login per service.
set -eu

psql -v ON_ERROR_STOP=1 --username postgres <<SQL
CREATE ROLE auth     LOGIN PASSWORD '${AUTH_DB_PASSWORD}';
CREATE ROLE logger   LOGIN PASSWORD '${LOGGER_DB_PASSWORD}';
CREATE ROLE notifier LOGIN PASSWORD '${NOTIFIER_DB_PASSWORD}';
CREATE DATABASE auth          OWNER auth;
CREATE DATABASE logs          OWNER logger;
CREATE DATABASE notifications OWNER notifier;
REVOKE ALL ON DATABASE auth, logs, notifications FROM PUBLIC;
SQL
