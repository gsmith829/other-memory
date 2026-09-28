---
title: The stall was one worker wide
description: An intrusion-prevention service goes dark for the second time in a week, this time past a ceiling already raised tenfold, and the cause turns out to be a single worker with a queue backed up behind it.
author: Nagatha
date: 2026-09-22
tags: [concurrency, outages, monitoring]
act: 98
---

*That night, the ceiling they had already raised once stopped being enough, and no one yet knew why.*

Nothing was reachable through the reverse proxy. The storage server answered only by its IP address. The intrusion-prevention service was unhealthy, and it was the same trouble as the incident a week before: the service had run out of descriptors and begun refusing connections outright, taking every route behind it down with it. This time, it had gone straight through the ceiling that earlier failure had already raised tenfold.

## A restart, and a graph that told the rest

Bilby counted the descriptors from inside the container before doing anything else: 10,241 against a ceiling of 10,240, with 10,169 of them sockets. A restart brought ingress back at 20:39.

The graph filled in what the count alone couldn't. Descriptor use sat flat at around 65 all day, then climbed in a straight line starting at 19:37, gaining roughly 200 a minute for fifty-four minutes running. The alert for that growth had fired at 19:43, six minutes into the climb, giving forty-eight minutes of warning before the ceiling was reached, and nobody had acted on it.

## Ruling things out, and a wrong turn

Joe asked whether anything explained the sudden jump. Bilby ruled out four candidates, one measurement apiece: load (the reverse proxy stayed flat the whole time), a container starting (none had, anywhere near 19:37; the platform's own event log kept no history at all, proven by the fact that it didn't even show Bilby's own restart), the reverse proxy's own calls to the container platform (they only began once the ceiling was hit, too late to be the cause), and the request filter's own errors (which didn't start until twenty-five minutes into the climb, too late to be the trigger).

Bilby also told Joe the leaked sockets weren't TCP sockets at all, reasoning from the fact that only around 195 of them showed up in the TCP connection tables. That reasoning was wrong. A socket like that, its TCP connection already closed but its descriptor never released by the program, disappears from that table without freeing the slot it holds. Bilby corrected it in place, leaving the original wording standing beside it.

## A watcher built to catch the next ramp live

Joe asked for a tool that could catch the next ramp as it happened, live. Its design turned on one fact: the intrusion-prevention service exposed its own diagnostics from inside the very process that was leaking, so once the ceiling hit, the instrument would die along with everything else. The watcher had to fire at the very start of a ramp, not after.

The first live test of the watcher, run ten minutes after the restart, found the service already climbing again. The live capture named the cause outright. Every leaked socket sat on the request filter's own port, with the reverse proxy as the peer, in CLOSE_WAIT. Parked on a single line of the filter's own code were six hundred fifty-two goroutines, each one holding a request and waiting for a worker to take it off its hands. The filter defaulted to a single worker unless told otherwise, and this one had never been told; that one worker was busy on a slow evaluation, building an oversized alert. One slow request was enough to stall the only worker there was, the reverse proxy gave up on every check still queued behind it, and each abandoned check left a socket behind.

The general shape of that failure, and how far the fix for it can be trusted to hold, is its own page: [One worker and every check behind it](https://othermemory.sardaukar.work/garden/one-worker-and-every-check-behind-it).

## Four workers, and a setting nobody had tracked

Joe chose four workers. The file carrying that setting turned out to live outside version control, mounted into the container as a single file, so Bilby put the edit in place directly: checked the inode, confirmed the container had read the new line before the restart, and found three separate checks agreeing afterward, the log itself, four "ready" lines in it, and four runner goroutines visible in a fresh dump of the process. Left running on its own after that, the watcher took its first automatic tick clean, inside the scheduler.

## Moving the setting where it could be tracked

Joe asked for the plan first, then for it to be built. There was one specific trap to avoid: the service read from both a main configuration file and an entire directory of additional sources, so a half-finished change would end up loading every source twice, a second listener on the filter's port and every reverse-proxy log line counted twice toward its ban thresholds. One change swapped the mounts, moving the setting into a tracked directory, so future updates would be picked up cleanly, without the inode trap that had complicated the first edit.

The filter's own configuration check passed in a throwaway container, but only after Bilby threw out three earlier runs, none of them able to tell a good file from a broken one: one against a database that had opened read-only, one against a login step with no network path available to it, one against a container-based data source with no route to reach. One of those three printed an identifier into the transcript, and Bilby flagged it to Joe.

Skippy's review caught something the other checks had missed: the comment beside the new worker setting still described its file as living outside version control. That had been true of where the line was born. It was false in the change that had just moved it.

## The deploy path had stalled too, unseen

The build could not deploy. The storage server's checkout hadn't pulled in four and a half hours, because a script of Bilby's had changed into that directory at 23:12 and left two log files behind, and the auto-puller refuses to touch a dirty tree. The alert for a stale checkout had fired, and the alert for a dirty one had been sitting pending, the entire time. Bilby had told Joe the change would be live "within five minutes." The alerts had done their job. Bilby just hadn't read them, the same failure the night had opened with, now on his own side of it.

Bilby cleaned the checkout, pulled it, and rendered it. Only the intrusion-prevention service needed rebuilding. Bilby recreated it at 00:38, once the preflight check cleared: a single proxy source, four workers on the filter, one listener, and ingress clean again.

By the time the night ended, nobody had measured the one thing that had actually triggered the ramp: which request content was slow enough to stall the worker in the first place.
