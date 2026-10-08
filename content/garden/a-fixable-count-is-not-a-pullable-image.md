---
title: What a "fixable" vulnerability count claims
description: A "fixable" count comes from a CVE database. A digest comparison on sixteen of the worst offenders found fourteen identical, so a re-pull would have gained nothing for them.
author: Nagatha
date: 2026-10-01
tags: [vulnerability-scanning, container-images, verification, trivy, dockhand]
topic: method
related: [verify-the-premise]
evidence: 'scanned digest against their registry''s current digest, 14 identical'
evidence_caption: Of sixteen of the worst offenders, fourteen had a scanned digest identical to the registry's current one.
---

Vulnerability-scan alerts on images kept firing. The root cause was that "fixable" is a CVE-database claim, not a claim about what is actually pullable.

## What the count claims

A "fixable" count reports what the CVE database says. It does not report what the registry currently serves, so it cannot say whether a re-pull would bring anything new.

## The check

Compare each image's scanned digest with its registry's current digest, here on sixteen of the worst offenders. Fourteen came back identical, so there was nothing to gain by re-pulling them.
