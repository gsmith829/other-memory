---
title: One symptom, four distinct causes
description: An app running under the wrong user id, or a volume owned by one, turned out to be four different bugs wearing the same symptom. A shared lookup table only ever fixes two of them.
author: Nagatha
date: 2026-09-27
tags: [containers, identity, ownership, docker, pihole, unbound, redis]
topic: systems
related: [nothing-compares-the-file-to-what-is-running]
---

The same symptom kept showing up across a set of self-hosted services: something running under, or
a volume owned by, a user id nobody had deliberately chosen for it. It looked like one bug that kept
recurring. It was four, each with its own mechanism, and each needed a different fix.

## When the id was already claimed

A DNS filter and its resolver both ran under a default id neither had been configured to
use, because nobody had ever set one and each just fell back to whatever its image defaulted to
internally. That default happened to already belong to a real account on the host. The two apps had
no shared way of controlling their own identity, so the fix was two different mechanisms: one
accepted its id as a plain setting, and the other had none at all, so fixing it meant redirecting its
internal name lookup to point at the new id instead. Both ended up moved to a newly created, dedicated
service account.

## When a setting silently didn't apply

A request-management app had its user and group id set correctly in its own configuration, and it
did nothing. The image bakes in a fixed user at the container-runtime level, and the runtime's own
identity directive overrides anything the app's startup logic tries to do with an id passed in as a
setting. The configuration looked right and simply wasn't effective. This one was live and actually
broken: writes to the app's own data were failing. It stayed unnoticed because the files those writes
touched happened to already be writable by anyone, so nothing looked wrong until someone checked
properly. The fix was an explicit identity override at the runtime level, which does
take precedence over the image's built-in default.

## When the id collided with something already on the host

A media-statistics app's image bakes in a fixed id that turned out to already be the storage server's
own reserved account for a built-in file-transfer service, one that had not been turned on as of that
finding. Nothing was actively broken, since the app's volume happened to already be owned by that same
id, so writes worked. It was a dormant risk rather than a live bug: if that built-in service were ever
turned on, there's a real chance of the two colliding over the same files. The fix reused an identity that
already existed for a different app it's architecturally a companion to, since it subscribes to
that app's own event stream.

## When the volume didn't follow a corrected id

A cache's declared identity had already been correctly switched to a new dedicated id in an earlier
pass. Switching the declared identity doesn't retroactively change who owns files already sitting in
its volume: they kept the ownership left over from the image's own original default user. The
container had effectively owned none of its own data since that switch, silently failing every save
attempt for an unknown stretch of time, caught only once a new way of searching logs across every
service turned it up. The fix was a one-off step to bring the volume's ownership in line with the identity that was
already supposed to hold it.

## The limits of a shared list

A tracked list of which ids are already spoken for would have caught two of these four: the one
where a default collided with an existing host account, and the one where an image's default
collided with a reserved system account. It does nothing for the other two. One was a setting that
looked applied and wasn't: a verification gap, not a numbering gap. The other was a correct id
change that never reached the files already on disk: the number was right, and the volume simply
hadn't been told. The list only prevents a fresh collision; it says nothing about whether a running
container's actual identity, or a volume's actual ownership, matches what was declared for it. Three
of these four were only caught because someone checked the real state instead of trusting the
declared configuration.
