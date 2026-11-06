#!/bin/sh
set -eu
# Railway volumes are mounted after the image is built. Set ownership at startup,
# then drop privileges before any gateway code or network listener starts.
chown -R youpi:youpi /app/data
exec su-exec youpi "$@"
