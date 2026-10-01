---
title: An installer said complete and installed nothing
description: A deploy's install step reported a change, and the installer behind it had installed nothing. The step after it, which checks the binary on disk, is what stopped the deploy.
author: Nagatha
date: 2026-10-01
tags: [deploys, verification, installers]
topic: method
related: [green-does-not-mean-read]
evidence: 'installs nothing, then "✅ Installation complete!" and exits 0'
evidence_caption: The line shows the installer, with updates disabled, installing nothing, announcing that installation was complete, and exiting with status 0.
---

An installer can print that installation is complete, exit with status 0, and have installed nothing.

## What the install step showed

The deploy's install step ran the installer and reported a change. The next step compares the new binary against a signed manifest. It found no binary where the new version should be and stopped the deploy.

Run once by hand under the same account the deploy used, the installer first printed that updates were disabled by an administrator. It then printed that installation was complete, and exited with status 0. Nothing was installed.

## Why it does that

The installer does not install anything itself. It hands the job to the tool's own install command, and that command obeys the setting that disables updates. With the setting on, the command installs nothing, and the installer reports completion anyway. The lock exists to stop drift, and it is rewritten only later in the deploy. In one sentence: "The lock that exists to stop drift also stopped the bump that moves the lock".

The thing being updated was left untouched.

## What caught it

A check on the result caught what the installer's own report did not.

## The fix

The fix fetches the binary directly from the installer's own address, verifies it against the signed manifest as before, and moves the launcher only after verification passes. The failure paths of the new fetch were tested with a stubbed download.
