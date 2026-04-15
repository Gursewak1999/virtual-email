# Future Proofing

- Keep an optional backfill path to replay missed inbound emails when webhooks fail temporarily (deploy outages, transient 5xx/timeouts, or misconfiguration windows), so Postgres and Storage remain complete.
