# Architecture views — Needs, Functional, Logical

Status: exploratory sketch (research surface, not a decided spec). Three arch-framework-style
views of the repository and its immediate ecosystem, grounded in the README,
`docs/architecture/end-state-vision.md`, and the ADR corpus.

## 1. Needs architecture — who needs what, and why

```mermaid
flowchart LR
    subgraph Stakeholders
        CT["Civic technologists,<br/>journalists, students"]
        GOV["Government workers /<br/>data publishers"]
        VER["Downstream verifiers<br/>(readers of AI analyses)"]
    end

    N1["N1: Query public civic data<br/>in plain English, no coding"]
    N2["N2: Trust AI-mediated analysis —<br/>inspectable, reproducible, verifiable"]
    N3["N3: Durable, citable evidence<br/>(timestamped, archived)"]
    N4["N4: Interoperability — open standards,<br/>not a proprietary silo"]

    CT --> N1 & N2
    GOV --> N2 & N4
    VER --> N2 & N3
```

## 2. Functional architecture — what the system does

```mermaid
flowchart LR
    F1["F1: Discover & query<br/>civic datasets<br/>(NYC Open Data, Data Commons)"]
    F2["F2: Analyze & visualize<br/>via AI assistant"]
    F3["F3: Package analysis as<br/>signed evidence<br/>(hash, sign, timestamp)"]
    F4["F4: Publish to<br/>evidence registry"]
    F5["F5: Verify evidence<br/>(signature, timestamp,<br/>transparency log)"]
    F6["F6: Govern the standard<br/>(spec, ADRs, open questions)"]

    F1 --> F2 --> F3 --> F4 --> F5
    F6 -.constrains.-> F3 & F4 & F5
```

## 3. Logical architecture — what components realize it (this repo highlighted)

```mermaid
flowchart TB
    subgraph Clients["AI clients"]
        CC["Claude Code / Copilot / Cursor"]
    end

    subgraph ThisRepo["civic-ai-tools (this repo)"]
        CFG["MCP configs<br/>.mcp.json, .cursor, .codex"]:::thisRepo
        SKILL["publish-evidence skill<br/>+ opengov skill docs"]:::thisRepo
        SPEC["Typed Standards Spec<br/>ADRs, open-questions registry,<br/>doctrine docs"]:::thisRepo
    end

    subgraph Servers["MCP servers"]
        SOC["socrata-mcp-server<br/>→ NYC Open Data"]
        DC["Data Commons MCP<br/>→ Google Data Commons"]
    end

    subgraph Ecosystem["Companion components"]
        WEB["civic-ai-tools-website<br/>evidence registry + publish API"]
        TS["typedstandards.org<br/>verify-core + client verifier"]
        TRUST["Sigstore Rekor + RFC 3161 TSA<br/>(signing / timestamp infra)"]
    end

    CC --> CFG --> SOC & DC
    CC --> SKILL --> WEB
    WEB --> TRUST
    TS -.verifies.-> WEB
    SPEC -.specifies.-> WEB & TS & SKILL

    classDef thisRepo fill:#1f6feb,stroke:#0d419d,color:#ffffff
    style ThisRepo fill:#dbeafe,stroke:#1f6feb,color:#0d419d
```

## Cross-layer traceability

Hierarchical trace from needs through functions to the logical components that realize
them. Solid edge = primary realization, dotted edge = supporting. Blue nodes live in
this repo.

```mermaid
flowchart LR
    subgraph Needs
        N1["N1 plain-English<br/>data access"]
        N2["N2 trustworthy<br/>AI analysis"]
        N3["N3 durable, citable<br/>evidence"]
        N4["N4 open-standards<br/>interop"]
    end

    subgraph Functions
        F1["F1 query"]
        F2["F2 analyze"]
        F3["F3 package"]
        F4["F4 publish"]
        F5["F5 verify"]
        F6["F6 govern"]
    end

    subgraph Components["Logical components"]
        CFG["MCP configs"]:::thisRepo
        SOC["socrata-mcp-server /<br/>Data Commons MCP"]
        SKILL["publish-evidence skill<br/>+ opengov skill docs"]:::thisRepo
        WEB["evidence registry<br/>(civic-ai-tools-website)"]
        TS["verify-core +<br/>typedstandards.org verifier"]
        TRUST["Rekor + RFC 3161 TSA"]
        SPEC["Typed Standards Spec,<br/>ADRs, open-questions registry"]:::thisRepo
    end

    N1 --> F1
    N1 --> F2
    N2 --> F3
    N2 --> F4
    N2 --> F5
    N2 -.-> F2
    N2 -.-> F6
    N3 --> F3
    N3 --> F5
    N3 -.-> F4
    N4 --> F6
    N4 -.-> F3
    N4 -.-> F4
    N4 -.-> F5

    F1 --> CFG
    F1 --> SOC
    F2 --> SOC
    F2 -.-> SKILL
    F3 --> SKILL
    F3 --> TRUST
    F4 --> SKILL
    F4 --> WEB
    F5 --> TS
    F5 --> TRUST
    F6 --> SPEC
    F3 -. constrained by .- SPEC
    F4 -. constrained by .- SPEC
    F5 -. constrained by .- SPEC

    classDef thisRepo fill:#1f6feb,stroke:#0d419d,color:#ffffff
```

Reading notes: F2's dotted edge to the skill docs reflects that reproducibility starts in
the analysis itself (queries recorded, no hallucinated data — the opengov skill's rules);
N3's dotted edge to F4 reflects that the registry makes evidence citable while durability
comes from F3/F5's timestamp and transparency-log steps; N4's dotted edges mark F3–F5 as
the functions the open standard disciplines. The dotted `constrained by` edges between
F3–F5 and the spec are arrowless and declared function-to-spec so the layout keeps its
three stacked bands (an edge running the other way, spec-to-function, would fight the
Functions→Components edges above it and break the vertical stacking); semantically the
constraint flows from the spec to the functions (it specifies F3's package shape and F5's
§9.2 verification sequence, and constrains F4's publish API contract).

### Needs × Logical components

| Need | Function(s) | Logical component(s) |
| --- | --- | --- |
| N1 plain-English data access | F1, F2 | MCP configs, socrata-mcp-server, Data Commons MCP |
| N2 trustworthy AI analysis | F3, F4, F5 | publish-evidence skill, evidence registry, verifier, Rekor/TSA |
| N3 durable citable evidence | F3, F5 | Rekor transparency log, RFC 3161 timestamps (Zenodo DOI designed) |
| N4 open-standards interop | F6 | Typed Standards Spec, ADRs, open-questions registry |

Note: the runnable artifacts in this repo are the MCP configs and the publish-evidence
skill; the spec/ADR corpus is the repo's main payload, with the registry and verifier
implemented in the companion repos.
