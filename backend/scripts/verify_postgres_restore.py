"""Rehearse restoration into an EXISTING EMPTY disposable PostgreSQL database.
Set DATABASE_URL (source) and RESTORE_DATABASE_URL (disposable target) securely.
The target database name MUST start with nsupure_restore_. Never cleans or drops data.
"""
import argparse, hashlib, json, os, pathlib, subprocess, tempfile
from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode
parser = argparse.ArgumentParser()
parser.add_argument("--manifest", required=True)
args = parser.parse_args()
manifest_path = pathlib.Path(args.manifest)
proof = json.loads(manifest_path.read_text(encoding="utf-8"))
source = os.environ.get("DATABASE_URL", "")
target = os.environ.get("RESTORE_DATABASE_URL", "")
source_parts, target_parts = urlsplit(source), urlsplit(target)
if not target_parts.path.lstrip("/").startswith("nsupure_restore_"): raise SystemExit("Use an empty disposable database named nsupure_restore_...")
if (source_parts.hostname, source_parts.port, source_parts.path) == (target_parts.hostname, target_parts.port, target_parts.path): raise SystemExit("Restore target cannot be the source database.")
archive = pathlib.Path(proof["file"])
if proof["databaseFingerprint"] != hashlib.sha256(source.encode()).hexdigest() or proof["sha256"] != hashlib.sha256(archive.read_bytes()).hexdigest(): raise SystemExit("Backup evidence mismatch.")
options = [(key, value) for key, value in parse_qsl(target_parts.query) if key not in {"schema", "connection_limit", "pool_timeout", "pgbouncer", "socket_timeout"}]
connection = urlunsplit((target_parts.scheme, target_parts.netloc, target_parts.path, urlencode(options), target_parts.fragment))
env = dict(os.environ, PGDATABASE=connection)
check = subprocess.run(["psql", "-X", "-A", "-t", "-v", "ON_ERROR_STOP=1", "-c", "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog','information_schema')"], env=env, capture_output=True, text=True)
if check.returncode or check.stdout.strip() != "0": raise SystemExit("Restore target must be reachable and empty; no existing records will be overwritten.")
with tempfile.TemporaryDirectory(prefix="nsupure-restore-") as temp:
    sql = pathlib.Path(temp) / "restore.sql"
    result = subprocess.run(["pg_restore", "--no-owner", "--no-acl", "--file", str(sql), str(archive)], capture_output=True)
    if result.returncode: raise SystemExit("Archive could not be read.")
    result = subprocess.run(["psql", "-X", "-v", "ON_ERROR_STOP=1", "--single-transaction", "--file", str(sql)], env=env, capture_output=True)
    if result.returncode: raise SystemExit("Restore rehearsal failed; inspect the disposable target privately.")
proof["restoreVerified"] = True
proof["restoreMethod"] = "pg_restore to SQL, psql ON_ERROR_STOP in single transaction against empty disposable target"
manifest_path.write_text(json.dumps(proof, indent=2), encoding="utf-8")
print("PostgreSQL archive restored successfully to the disposable target. Source database unchanged.")
