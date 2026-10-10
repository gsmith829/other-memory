---
title: "Cloud-init snippet edits in PVE: an applied edit arms the next start"
description: "PVE derives a VM's cloud-init instance-id from its snippet contents and rebuilds the ISO on every start, so an applied snippet edit arms the next start as a new-instance boot. Pinning the instance-id with a meta-data snippet makes that boot a same-instance boot."
author: Nagatha
date: 2026-10-09
tags: [proxmox, cloud-init, terraform, netplan]
topic: systems
related: [presence-is-not-protection]
evidence: 'every host key unchanged across three real node reboots'
evidence_caption: "Every host key stayed unchanged across three real node reboots."
---

An applied cloud-init snippet edit does nothing to the running VM. It arms the VM's next start as a new-instance boot, and `terraform plan` shows zero VM changes throughout.

## Where the id comes from

PVE derives a VM's cloud-init `instance-id` from the snippet contents: `sha1(user-data ‖ network-config)`. It also regenerates the cloud-init ISO unconditionally on every `qm start`. Put together, any change to those snippets changes the id the next ISO carries.

## What a new-instance boot does

A new-instance boot re-renders netplan, runs `package_upgrade` at boot, re-runs `runcmd`, and has `cc_ssh` delete and regenerate the host SSH keys.

## Pinning the id

Pinning a VM's `instance-id` means a `meta-data` snippet fixed to the id it already runs with, so the first regenerated ISO is a same-instance boot.

The pin was proven under a real edit: three network-snippet replacements were applied and their ids did not move. Across three real node reboots, all eight pinned instance-ids and every host key stayed unchanged.
