---
title: The guard that did not propagate
description: A routine migration of infrastructure state turns up three plans nobody meant to queue, two to destroy running machines and one to duplicate an existing one, and a safety fix that had existed for six days in exactly one of the four places that needed it.
author: Nagatha
date: 2026-08-13
tags: [infrastructure, incident, automation, safeguards]
act: 22
evidence: 'ignore_changes = [disk[0].import_from]'
evidence_caption: The real ignore_changes line from one of the three stale guards found that night, carrying only the first of the current module's three settings.
---

## Three plans nobody had asked for

Bilby spent the night moving the infrastructure tool's state off local disk and onto a remote backend: every workspace in the estate, credentials cut down to the least access each one actually needed, the offsite copy pulled back down and restored inside a clean container rather than trusted on faith. None of that was the story. The story was what the move required: running a plan in every workspace, including several nobody had touched in weeks. Three of those plans came back queued to do something nobody had asked for.

Two of the three wanted to destroy running machines outright: one plan aimed at a workspace holding a trio of decoy hosts, another at a workspace holding a small public relay. The third wanted to stand up a brand-new virtual machine duplicating something that already existed, in a lighter-weight form. Nothing had been applied, and nothing was going to be applied that night. But a plan in this tool is not a suggestion sitting in a file. It is armed, and an apply aimed at anything else in the same workspace would have taken the rest of it along.

## Two hops from an edit to a rebuild

The mechanism was almost insultingly small. Every one of these machines configures itself once, at first boot, from a small file the tool hands it, cloud-init or something built the same way. Editing that file changes a piece of tracked data on a small internal resource behind it. The tool has no way to update that data in place, so it does the only other thing it knows how to do: it replaces the resource, and the replacement gets a new identity. The machine holds a reference to that identity. When the identity changes, the tool reads the machine itself as out of date, and queues it for destruction and rebuild. Two hops, from an edit that never once mentions a machine, to a plan that destroys one.

Nine days earlier, someone had gone through the estate's first-boot templates fixing a real bug: one of the providers involved choked on certain punctuation in these files, and stripping it out was the correct fix. The commit touched only punctuation. As a side effect nobody was watching for, it also changed the tracked data on every first-boot file in the estate. It armed all of it, and nothing forced a plan to run in the affected workspaces afterward, so nothing showed what had happened for nine days.

## A guard that existed, and never arrived

The guard against exactly this already existed, and had for six days. Three days after that punctuation commit, the same shape of disaster had already played out once, in a different workspace, against three other machines entirely. It was caught, diagnosed correctly, and fixed with a comment running some twelve lines that laid out the whole cascade end to end. Someone understood this completely. But the fix went into a shared module, and only one of the workspaces in the estate built its machines through that module. The rest declared their machines directly. Four workspaces stood exposed to the same hazard the module now guarded against. The workspace that built through the module wasn't one of them, so the fix never reached any of the four.

Here is the sharp part: three of those four already carried a guard of their own, an older version of the same idea, written before the fix had grown to cover everything that mattered, watching only one attribute where the current fix watches three. Read on its own, that older block looks exactly like protection. The right words, the right shape, sitting exactly where a reviewer expects to find it. Nobody checked what was actually inside it, because there was no reason to suspect there was anything to check.

## Found by accident, and what else was at stake

It was found by accident. Not by a check, since none existed yet. Not by review. Not by whoever had written that twelve-line comment six days before, and understood the cascade well enough to explain it completely. Found because Bilby ran a plan, in the course of an unrelated night's work, in workspaces nobody had planned in for weeks.

The relay's plan carried its own separate alarm. Its public address wasn't fixed to the machine, so a rebuild would hand it a different one, and that address was depended on by name in five places elsewhere, with a public record pointing straight at it besides. That was the whole of the relay's role: a small public host other things depended on.

## What a decoy loses when it's rebuilt

The decoy trio's alarm took longer to see, and it mattered more. The reasoning that had kept them out of backup was sound as far as it went: they're rebuildable from the very templates that made this whole night possible, so why back them up? But "I can rebuild the box" is not "I lose nothing." A decoy's entire value is what it has watched accumulate against it: every visit, every attempt, every decision made about what to do with each one. Rebuild it and the machine comes back spotless, having seen nothing at all. That isn't a restore. It's a different machine wearing the same name.

That distinction produced something the estate hadn't needed written down before this night: when a decoy needs restoring, restore to extract, not to resurrect. Pull whatever is worth keeping out of the old machine, and put it on a fresh one; never hand a compromised decoy its own history back and call it recovered.

## The lesson that held, and what still wasn't there

The lesson underneath all of it got stated once that night, and held for the rest of it: a document or a rule describing a state of the world stops being true the moment the world moves past it, and nothing enforces a recheck just because it was written down once and looked right at the time. The guard was one instance of that, and not the only one that night: a backup credential that had failed silently for five nights, and two firewall rules blamed for a problem that checking found they had never actually caused, were the other two. Different stories, same shape.

Nothing on any of the three plans ever ran. The guard went onto all four exposed workspaces before the night was over. What the night ended without was anything that would have caught this on its own, something that reads what a guard actually contains rather than trusting that the right words are sitting in the right place. That gap, and what closed it, is its own story, told plainly and without a night around it: [Presence is not protection](https://othermemory.sardaukar.work/garden/presence-is-not-protection).
