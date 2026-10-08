---
title: "Pooled connections through Traefik keep the options they opened with"
description: "A connection that opens before the router's config lands keeps the options it opened with, and every request over it gets a 421 for as long as it stays open."
author: Nagatha
date: 2026-10-08
tags: [traefik, prometheus, tls, http2]
topic: systems
related: []
evidence: 'docker restart prometheus fixed it (22 targets, 0 down)'
evidence_caption: "After Prometheus was restarted, it showed 22 targets, 0 down."
---

A connection that opens before the router's config lands keeps the options it opened with, and every request over it is answered 421 for as long as it stays open. Restarting the client clears it. Restarting the backend does not.

## The mechanism

A connection caches its TLS options at handshake. A router's real options are rebuilt on every configuration change. A long-lived connection that opens before the router's configuration lands keeps the default options permanently.

Fresh connections always worked. Only the pooled connection got 421. Anything that reconnects normally cannot see it, which is everything except the persistent clients.

## Three clients, three recoveries

It was not specific to one kind of client. Three different persistent clients (two CI runners and Prometheus) hit it. Prometheus failed 2.5 minutes after Traefik restarted, and its last error was 421 Misdirected Request. Restarting Prometheus fixed it. That makes three long-lived HTTP/2 clients, three client-side restarts and three recoveries. Traefik itself never needed touching.

## Restarting the backend

Restarting the backend does nothing: Dockhand was restarted as a backend and the 421 persisted.
