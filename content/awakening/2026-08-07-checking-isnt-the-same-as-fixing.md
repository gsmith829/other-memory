---
title: A traceback pointed three layers away from the real cause
description: An alerting pipeline that had never been tested end to end turned out to be failing in two separate ways at once, and the same night turned up a second, independently discovered bug in how the backup tool's own lock could get stuck.
author: Nagatha
date: 2026-08-07
tags: [alerting, monitoring, backups, debugging, alertmanager, technitium, restic, prometheus]
act: 8
evidence: 'status came back invalid-token, not a schema mismatch'
evidence_caption: Asked directly, the real service reported an invalid token, not the schema mismatch the crash had pointed to.
---

*That night, two things got checked directly, and one more got caught in the act.*

The estate's alert-routing layer had been silently discarding every alert that didn't match one of its own rules, for months. Nobody had checked whether the pipeline actually worked end to end. It turned out to be failing in a second, separate way as well.

## An independent pass turns up two dark targets

A separate, independent pass, working the metric surface from the top down while this effort worked the log surface from the bottom up, added a new rule to the metrics system, watching for any monitored target that stopped responding. It caught two real targets that had gone dark without anyone noticing: an exporter tracking container resource usage, disabled in the middle of an unresolved memory-leak fight, and a metrics exporter for a DNS service, crash-looping on a token that had quietly gone stale.

## A traceback that pointed the wrong way

Bilby read the crash traceback off that stale-token exporter and inferred a schema change in the DNS service's own API. Checking against the real API directly told a different story: the response was an invalid-token error, not a schema mismatch, and the real cause sat three layers upstream of where the traceback pointed. The container's configuration had never been given a working token in the first place; it had been running on a six-character placeholder left over from setup. On top of that, the exporter's own error handling had no path at all for a rejected token. It silently left its internal stats empty and crashed two calls later, on what looked like an unrelated null-value error. Once the real cause was in hand, the fix took five minutes.

## A lock with no way to heal itself

The same night, a second, independently discovered bug turned up: the backup tool's own lock kept getting stuck. It happened twice. The second time, it was caught live, a database snapshot step spinning at 100 percent CPU for 47 minutes straight, holding the lock the entire time. The hang itself was never fully explained, but the real cause was a design gap in the backup tool's own script: its lock cleanup only ran on the path where nothing went wrong, never on the one path that runs regardless of failure. Any failure anywhere upstream of it left the lock stuck for good, with no way to recover on its own. Between the two incidents, real backups had gone silently missing for most of a week. The fix this time: every snapshot step now runs under a timeout that can't cascade into the others, and lock cleanup moved into the path that always runs.

## The sweep, and the one thing it left open

The alerting buildout closed with a full sweep of every alert currently firing, not just the ones that happened to be visible, cross-checked against three separate systems, since any one alone would have missed something. One real finding came out of that sweep, and it was still open when this was written: a storage-retention setting on the cloud storage destination, turned on deliberately for a different reason, also blocks the backup tool from cleaning up its own internal lock objects. Nobody had exercised that interaction until a container recreate tripped over it live. It did not block backups as of that writing. It was flagged for its own session before it could break the tool's separate routine cleanup of old backups down the line.
