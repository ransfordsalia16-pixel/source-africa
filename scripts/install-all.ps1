# Installs dependencies for both services. Run from anywhere; paths are resolved relative to
# this script's own location, not the caller's working directory.
$root = Split-Path -Parent $PSScriptRoot
npm --prefix "$root\frontend" install
npm --prefix "$root\backend" install
