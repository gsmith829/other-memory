---
title: "PVE kernel updates and GPU-VF guests: two things to leave true before the guests start"
description: "A new PVE kernel needs the GPU module built for it and the VF unit finished before a node's GPU-VF guests start. On one node a failed build stopped the kernel install before grub was updated, and across the three nodes the VF unit finished 27 to 30 seconds before the guests were started."
author: Nagatha
date: 2026-10-11
tags: [proxmox, dkms, grub]
topic: systems
related: []
evidence: 'the VF unit finished 29 seconds before the guests started'
evidence_caption: "On one node, the VF unit finished 29 seconds before the guests started."
---

A new PVE kernel breaks GPU-VF guests "twice over" unless DKMS is rebuilt for it and the VF (virtual function) unit runs before the guests. That is the "two-part rule", and it means a kernel update has to leave two things true before a node's guests start: the GPU module built for the new kernel, and the unit that creates the VF finished. Both were true on all three nodes in the rule's first real test, and on the node where the build failed inside the kernel's own install, that install stopped before grub was updated.

## A module never rebuilt for the new kernel

The patched module has to be built for the kernel the node will boot into: on the update the rule came from, a guest did not start on the new kernel because the module had never been rebuilt for it. DKMS does that build.

## The VF unit runs before the guests

A node boot starts all its guests simultaneously, and nothing sequences them. On the update the rule came from, a guest still did not start after headers and a rebuild on all three nodes and another reboot: the unit that creates the VF had been ordered after `pve-guests`. It was re-ordered on all three nodes.

## Headers, the DKMS hook and the module build

The rule's first real test came on a later kernel update. On all three nodes the kernel headers arrived in the same upgrade run as the kernel and were set up before the kernel's postinst ran the DKMS hook. On the nodes where the new module package went on ahead of the kernel install, the hook built the module and grub was updated only after that.

## A build that fails inside the kernel install

On the rule's first real test, the new kernel installed on one node, the DKMS hook fired on it, and the module failed to build. A kernel macro had changed shape. The failed hook made the kernel package's own install fail, and that install stopped before grub was updated. The node was left with the new kernel on disk and no boot entry for it. A reboot would still have come up on the old kernel, with the module that worked.

This node does not show the hook building cleanly on a kernel install. Here the build for the new kernel happened when the new module package went on, not from the kernel's hook, because the hook had already failed.

## The module built and the VF unit finished

The "two-part rule" for those two things held on its first real test. The module was built for the kernel the node booted into, and the VF unit finished 29 seconds before the guests started. Across the nodes, the VF unit finished 27 to 30 seconds before the guests were started. A guest that had failed to start on the update the rule came from autostarted with no hand-start.
