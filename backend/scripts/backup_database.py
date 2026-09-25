"""Create a verified SQLite backup or PostgreSQL custom archive. Never changes source data.
Uses DATABASE_URL from the environment, not command-line arguments.
PostgreSQL requires pg_dump/pg_restore on PATH and a separate restore rehearsal.
"""
import argparse, datetime, hashlib, json, os, pathlib, shutil, sqlite3, subprocess, tempfile
from contextlib import closing
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
parser = argparse.ArgumentParser()
parser.add_argument("--output", required=True, help="Private backup directory outside the repository")
args = parser.parse_args()
url = os.environ.get("DATABASE_URL", "")
if not url: raise SystemExit("Set DATABASE_URL securely in the environment.")
root = pathlib.Path(args.output).resolve()
repo = pathlib.Path(__file__).resolve().parents[2]
if root == repo or repo in root.parents: raise SystemExit("Backups must be stored outside the source repository.")
root.mkdir(parents=True, exist_ok=True)
stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
verified = False
if url.startswith("file:"):
    raw = pathlib.Path(url[5:])
    source = raw if raw.is_absolute() else pathlib.Path(__file__).resolve().parents[1] / "prisma" / raw
    source = source.resolve()
    if not source.is_file(): raise SystemExit("Source SQLite database does not exist.")
    target = root / (stamp + ".sqlite")
    with closing(sqlite3.connect(source.as_uri() + "?mode=ro", uri=True)) as src, closing(sqlite3.connect(target)) as dst:
        src.backup(dst)
        if dst.execute("PRAGMA integrity_check").fetchone()[0] != "ok": raise SystemExit("Backup integrity check failed.")
    with tempfile.TemporaryDirectory(prefix="nsupure-restore-") as temp:
        restored = pathlib.Path(temp) / "restored.sqlite"
        shutil.copyfile(target, restored)
        with closing(sqlite3.connect(restored)) as db:
            if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok": raise SystemExit("Restore rehearsal failed.")
    verified = True
elif url.startswith(("postgres://", "postgresql://")):
    target = root / (stamp + ".dump")
    # libpq connection environment prevents credentials appearing in process arguments.
    parts = urlsplit(url)
    options = [(key, value) for key, value in parse_qsl(parts.query) if key not in {"schema", "connection_limit", "pool_timeout", "pgbouncer", "socket_timeout"}]
    connection = urlunsplit((parts.scheme, parts.netloc, parts.path, urlencode(options), parts.fragment))
    env = dict(os.environ, PGDATABASE=connection)
    for command in (["pg_dump", "--format=custom", "--no-owner", "--no-acl", "--file", str(target)], ["pg_restore", "--list", str(target)]):
        result = subprocess.run(command, env=env, capture_output=True)
        if result.returncode: raise SystemExit("PostgreSQL backup verification failed. Inspect the database connection privately.")
else: raise SystemExit("Only SQLite and PostgreSQL are supported.")
manifest = {"file": str(target), "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
 "databaseFingerprint": hashlib.sha256(url.encode()).hexdigest(),
 "createdAt": datetime.datetime.now(datetime.timezone.utc).isoformat(), "restoreVerified": verified}
manifest_path = target.with_suffix(target.suffix + ".json")
manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
print("Backup created:", target)
print("Manifest:", manifest_path)
print("Restore verified." if verified else "Archive is readable. A full restore rehearsal is still required before migration.")
