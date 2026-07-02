# IPR Policy

Intellectual-property hygiene for the Civic AI Tools / Typed Standards project: what contributors certify on the way in, and what patent commitments the project makes on the way out. Adopted per [ADR-0017](docs/adr/0017-ipr-posture-dco-rf-statement.md) (decisions recorded on [civic-ai-tools#99](https://github.com/npstorey/civic-ai-tools/issues/99)). Companion to [LICENSING.md](LICENSING.md), which records copyright licenses, and [PATENTS.md](PATENTS.md), which carries the royalty-free patent statement.

## Scope

This policy applies to all four project repositories: **civic-ai-tools** (this repo), **socrata-mcp-server**, **civic-ai-tools-website**, and **typedstandards** (private pre-launch; public at spec launch).

## Inbound: Developer Certificate of Origin (DCO)

All contributions — code, documentation, and specification text — made after 2026-07-01 must be signed off. Add a `Signed-off-by: Your Name <your@email>` line to each commit (`git commit -s` does this automatically). The sign-off certifies the Developer Certificate of Origin 1.1:

```text
Developer Certificate of Origin
Version 1.1

Copyright (C) 2004, 2006 The Linux Foundation and its contributors.

Everyone is permitted to copy and distribute verbatim copies of this
license document, but changing it is not allowed.


Developer's Certificate of Origin 1.1

By making a contribution to this project, I certify that:

(a) The contribution was created in whole or in part by me and I
    have the right to submit it under the open source license
    indicated in the file; or

(b) The contribution is based upon previous work that, to the best
    of my knowledge, is covered under an appropriate open source
    license and I have the right under that license to submit that
    work with modifications, whether created in whole or in part
    by me, under the same open source license (unless I am
    permitted to submit under a different license), as indicated
    in the file; or

(c) The contribution was provided directly to me by some other
    person who certified (a), (b) or (c) and I have not modified
    it.

(d) I understand and agree that this project and the contribution
    are public and that a record of the contribution (including all
    personal information I submit with it, including my sign-off) is
    maintained indefinitely and may be redistributed consistent with
    this project or the open source license(s) involved.
```

Notes:

- Enforcement is currently by review convention; an automated DCO check may be added later without changing this policy.
- Contributions merged before this policy's adoption are unaffected by the sign-off requirement; their provenance is governed by the licenses under which they were submitted.

## Inbound: patent terms for specification contributions

The DCO covers copyright provenance, not patents. To keep the Specification implementable royalty-free, substantive contributions of **normative Specification text** are accepted only on the terms of [PATENTS.md](PATENTS.md) § Contributions: the contributor extends the same royalty-free covenant over the contributor's Essential Claims that are essential to the contributed text. Opening a pull request that adds or changes normative Specification text constitutes acceptance of those terms.

## Outbound

- **Code** — MIT, per-repo `LICENSE` files ([LICENSING.md](LICENSING.md) is the cross-repo record).
- **Specification text** — CC BY 4.0 (copyright).
- **Patents** — the maintainer's royalty-free statement in [PATENTS.md](PATENTS.md): a non-assertion covenant over Essential Claims for Conformant Implementations, on a scope-of-rights basis, with defensive suspension.

## Sequencing commitments

Per [ADR-0017](docs/adr/0017-ipr-posture-dco-rf-statement.md) and [civic-ai-tools#99](https://github.com/npstorey/civic-ai-tools/issues/99):

- This posture is a **gate before any formal public RFC review** of the Specification opens.
- The **reference SDK** (the `attest()`/`verify()` core and its shells) does not ship before this policy and [PATENTS.md](PATENTS.md) are in force.

## Questions

Open an issue on [civic-ai-tools](https://github.com/npstorey/civic-ai-tools/issues) — governance questions are welcome there.
