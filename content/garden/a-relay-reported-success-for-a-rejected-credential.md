---
title: A relay that answers success for a failed delivery keeps the sender's failure counter at zero
description: One credential, one relay and two counters that were read. The relay between an alerting system and a push-notification service told the sender every delivery had worked, so the sender's failure counter stayed at zero while nothing arrived.
author: Nagatha
date: 2026-10-01
topic: method
related: [a-hit-count-proves-its-own-layer-only, a-check-cant-fail-the-way-the-bug-does]
tags: [alerting, monitoring, credentials, observability]
evidence: 'Old server: 1 token, last used 19:47:44. New server: 0 tokens.'
evidence_caption: The old push-notification server held one token and had last used it at the time shown, while the new server held none.
---

An alerting system handed its notifications to a small relay, and the relay passed them to a push-notification service. The relay answered the alerting system with success whether or not its own publish to the push service had worked. So the alerting system's failure counter read zero while the relay's publishes were being rejected. This page holds that one case, at the width of what was measured: one credential, one relay, two counters that were read.

## What each reading showed

The relay's own log held 835 identical rejection lines, each a 401, counted since its container started. The relay had never delivered anything in that time.

Everything upstream of it read healthy. The metrics system's notification counter stood at 30793 sent and 0 errors. The alerting system's counter for its deliveries to the relay stood at 794 sent and 0 failed, describing "a pipe that delivered nothing." Both containers reported healthy. The push-notification service itself was working for another client, which is why the silence looked normal.

## Why the counters stayed at zero

The relay returned a 200 to the alerting system regardless of whether its own publish succeeded. An exception that is caught, logged and swallowed turns a hard failure into a silent one. The alerting system already has retry, backoff and a failure counter, and the swallowed exception disabled all three, so the counter stayed at zero across 794 deliveries that delivered nothing.

The relay now returns a 502 when a publish fails, and it exposes its own metrics, so the blindness is visible to an alerting rule and no longer only to a log.

## Why the credential was rejected

The token was never invalid. It was "valid on a database we retired." The push service keeps tokens as server-side records. When the service moved, its user database was rebuilt: the users and their permissions were recreated correctly, another client was issued a fresh token, and the alerting system's token was never reissued. The old server held 1 token and the new server held 0. The new server started ten minutes after the old token's last use.

"Verify the credential, not the service."

## What could disagree

A person noticing their phone was quiet was the sole check in the system capable of returning a different answer.
