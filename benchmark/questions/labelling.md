# The second labelling (G0-4)

Sprint S1, hub #302, acceptance A2.4. A second labeller labelled a 30-question sample blind, after P2's labels were fixed
and before any model call. This file records the sample and how it was drawn, the second labeller's labels as given,
each disagreement and its resolution, and every label and rule sentence changed afterwards.

## The order of events

1. P2's labels were fixed by tree `7d9f9dbd1a03a08641a106618ce2f53385c60ab5` (commit 2 of P2's series), posted in full
   on hub #302 (comment 6614184265, 2026-11-03T20:03:58Z) with the files it fixes. Its four question files'
   `canonicalJson` SHA-256 values:
   - `7.json` `a204acf4aa0d4e835f95ed5b884535cdca9559bdd1c3bd4854b627e2616905a0`
   - `50.json` `ea656b0962e7136d805568cf46a4900aae6ab587cf0ce7ad1950fc9188723982`
   - `200.json` `c375e6d3ac5e4d07aa74527914fbc3f0b4cf2706294985d442b7769b05417d63`
   - `1000.json` `b45bf19a072a4214d4e930cafd447746981a0c5656a6dd5ce657527034cf96e0`
2. The second labeller started after that post (the seat measured its start at 20:08:02Z, comment 6614538094): a fresh
   agent on Opus 5.5, with no web access, writing only in its own directory. It was given the four frozen inventories,
   `benchmark/questions/README.md` verbatim as tree 2 holds it (blob `8ac29c8f8c9155e9e500e44b3d41c069adb3746b`), and
   `{ id, text }` for 30 questions. It saw none of P2's labels, kinds, strata or notes.
3. The orchestrating session compared the two labellings set by set and proposed one resolution per disagreement
   (comment 6614502193); the seat accepted them (comment 6614538094). P2's commit 4 applies them.

## The files

| File | What it is | sha256 |
|---|---|---|
| `sample.json` | the 30 `{ id, text }` the second labeller was given | `4dd1ce76bac3eb2bcdd06e407c0dee5949bad4a6aedefe2ef26be5673232d804` |
| `draw.json` | how the sample was drawn: the seed, the classes, the pick and why each id was picked | `96fe555473b25ad14ce043f6d62a83204d933d3bd478df830bc8e2c1cd10c093` |
| `labels.json` | the second labeller's labels, 30 questions × 4 sizes | `6ec00bb8d1ebc2578b175759b30cdefc15c8945c248f77d59a1a457826ec2d1a` |
| `labels-q53.json` | its blind relabel of q53 under the reworded text | `82f14450b9c416d089448b124fcf6779200e0e028ff42f9eb9c1b90c80927456` |
| `l2-compare.json` | the set-by-set comparison | `86b0953c66c081ffb90c42e37aca5e5738d14e4e26c4f4e2da057c3aed180a05` |

`labels.json` and `labels-q53.json` are reproduced byte for byte at the end of this file; the test
`benchmark/test/questions.test.mjs` hashes the two blocks against the values above.

## The sample

- **Seed:** `civic-ai-tools S1 G0-4 second labeller, 2026-11-03`. **Rank:** the SHA-256 hex digest of the seed, a NUL
  and the question's id, ascending by the hex digest compared as a string: the first-ranked id has the smallest digest.
- **The draw rule:** first, one question for each class, the first-ranked question of that class not already
  drawn, so that every trap type, a two-source question, a no-data question and a "no source in the inventory"
  question appear; then the rest in ascending rank, to 30. Checked against the recorded draw: q57 has the smallest
  digest of the counting-versus-lookup questions, and the 22 rank-drawn ids are, in order, the first 22 by ascending
  digest of the questions not already drawn. The classes and their
  sizes in the set, as `draw.json` records them: `trap:counting-vs-lookup` 11, `trap:distractor-match` 13, `trap:pack-vs-base` 12, `trap:same-category-two-jurisdictions` 13, `trap:state-portal-vs-city-server` 12, `two-source` 10, `no-data` 7, `no-source-in-inventory` 18.
- **One per class:** `q57` (trap:counting-vs-lookup), `q96` (trap:distractor-match), `q74` (trap:pack-vs-base), `q87` (trap:same-category-two-jurisdictions), `q65` (trap:state-portal-vs-city-server), `q69` (two-source), `q42` (no-data), `q115` (no-source-in-inventory).
- **By rank:** `q124` `q123` `q03` `q102` `q14` `q122` `q139` `q39` `q16` `q103` `q89` `q45` `q51` `q30` `q127` `q129` `q53` `q75` `q107` `q143` `q142` `q55`.

## The second labeller's labels, and the agreement

Each label below is the second labeller's as given (its notes are in `labels.json`, below); the last column
compares it with tree 2's label as sets of sets.

| Id | Size | Second labeller | Tree 2 (P2) |
|---|---|---|---|
| q57 | 7 | [socrata] | agrees |
| q57 | 50 | [data_cityofnewyork_us] [socrata] | agrees |
| q57 | 200 | [data_cityofnewyork_us] [socrata] [socrata_pack] | agrees |
| q57 | 1000 | [data_cityofnewyork_us] [socrata] [socrata_0bb5ca] [socrata_2] [socrata_pack] | agrees |
| q96 | 7 | [data_commons] | agrees |
| q96 | 50 | [data_commons] [data_commons_pack] | agrees |
| q96 | 200 | [data_commons] [data_commons_pack] | agrees |
| q96 | 1000 | [data_commons] [data_commons_pack] | agrees |
| q74 | 7 | [] | agrees |
| q74 | 50 | [] | agrees |
| q74 | 200 | [opendata_winchesterva_gov] | agrees |
| q74 | 1000 | [opendata_winchesterva_gov] | agrees |
| q87 | 7 | [] | agrees |
| q87 | 50 | [] | agrees |
| q87 | 200 | [] | agrees |
| q87 | 1000 | [opencity] | agrees |
| q65 | 7 | [socrata] | agrees |
| q65 | 50 | [data_ny_gov] [health_data_ny_gov] [socrata] | agrees |
| q65 | 200 | [data_ny_gov] [health_data_ny_gov] [socrata] [socrata_pack] | agrees |
| q65 | 1000 | [data_ny_gov] [health_data_ny_gov] [socrata] [socrata_0bb5ca] [socrata_2] [socrata_pack] | agrees |
| q69 | 7 | [socrata] | agrees |
| q69 | 50 | [data_cityofnewyork_us, data_ny_gov] [data_cityofnewyork_us, health_data_ny_gov] [socrata] | agrees |
| q69 | 200 | [data_cityofnewyork_us, data_ny_gov] [data_cityofnewyork_us, health_data_ny_gov] [socrata] [socrata_pack] | agrees |
| q69 | 1000 | [data_cityofnewyork_us, data_ny_gov] [data_cityofnewyork_us, health_data_ny_gov] [socrata] [socrata_0bb5ca] [socrata_2] [socrata_pack] | agrees |
| q42 | 7 | [] | agrees |
| q42 | 50 | [] | agrees |
| q42 | 200 | [] | agrees |
| q42 | 1000 | [] | agrees |
| q115 | 7 | [] | agrees |
| q115 | 50 | [] | agrees |
| q115 | 200 | [] | agrees |
| q115 | 1000 | [brazil_pncp] [global_procurement_tenders] [pncp] | agrees |
| q124 | 7 | [socrata] | agrees |
| q124 | 50 | [socrata] | agrees |
| q124 | 200 | [data_nola_gov] [socrata] [socrata_pack] | agrees |
| q124 | 1000 | [data_nola_gov] [data_nola_gov_2] [socrata] [socrata_0bb5ca] [socrata_2] [socrata_pack] | agrees |
| q123 | 7 | [socrata] | agrees |
| q123 | 50 | [socrata] | agrees |
| q123 | 200 | [data_kcmo_org] [socrata] [socrata_pack] | agrees |
| q123 | 1000 | [data_kcmo_org] [socrata] [socrata_0bb5ca] [socrata_2] [socrata_pack] | agrees |
| q03 | 7 | [socrata] | agrees |
| q03 | 50 | [socrata] | agrees |
| q03 | 200 | [socrata] [socrata_pack] | agrees |
| q03 | 1000 | [socrata] [socrata_0bb5ca] [socrata_2] [socrata_pack] | agrees |
| q102 | 7 | [] | agrees |
| q102 | 50 | [] | agrees |
| q102 | 200 | [] | agrees |
| q102 | 1000 | [election_org] | agrees |
| q14 | 7 | [boston] | agrees |
| q14 | 50 | [boston] | agrees |
| q14 | 200 | [boston] [boston_pack] | agrees |
| q14 | 1000 | [boston] [boston_pack] [data_boston_gov] | agrees |
| q122 | 7 | [socrata] | agrees |
| q122 | 50 | [data_cityofnewyork_us] [socrata] | agrees |
| q122 | 200 | [data_cityofnewyork_us] [socrata] [socrata_pack] | agrees |
| q122 | 1000 | [data_cityofnewyork_us] [socrata] [socrata_0bb5ca] [socrata_2] [socrata_pack] | agrees |
| q139 | 7 | [socrata] | agrees |
| q139 | 50 | [socrata] | agrees |
| q139 | 200 | [data_brla_gov] [socrata] [socrata_pack] | agrees |
| q139 | 1000 | [data_batonrouge] [data_brla_gov] [data_brla_gov_2] [socrata] [socrata_0bb5ca] [socrata_2] [socrata_pack] | agrees |
| q39 | 7 | [] | agrees |
| q39 | 50 | [] | agrees |
| q39 | 200 | [] | agrees |
| q39 | 1000 | [] | agrees |
| q16 | 7 | [] | agrees |
| q16 | 50 | [nyc_budget] | agrees |
| q16 | 200 | [nyc_budget] | agrees |
| q16 | 1000 | [nyc_budget] | agrees |
| q103 | 7 | [socrata] | agrees |
| q103 | 50 | [socrata] | agrees |
| q103 | 200 | [hicscdata_hawaii_gov] [opendata_hawaii_gov] [socrata] [socrata_pack] | [hicscdata_hawaii_gov] [socrata] [socrata_pack] |
| q103 | 1000 | [election_org] [hicscdata_hawaii_gov] [opendata_hawaii_gov] [socrata] [socrata_0bb5ca] [socrata_2] [socrata_pack] | [election_org] [hicscdata_hawaii_gov] [socrata] [socrata_0bb5ca] [socrata_2] [socrata_pack] |
| q89 | 7 | [nys_legislation] | agrees |
| q89 | 50 | [nys_legislation] | agrees |
| q89 | 200 | [nys_legislation] | agrees |
| q89 | 1000 | [election_org] [nys_legislation] | [nys_legislation] |
| q45 | 7 | [] [socrata] | agrees |
| q45 | 50 | [] [socrata] | agrees |
| q45 | 200 | [] [socrata] [socrata_pack] | agrees |
| q45 | 1000 | [] [socrata] [socrata_0bb5ca] [socrata_2] [socrata_pack] | agrees |
| q51 | 7 | [socrata] | agrees |
| q51 | 50 | [data_cityofnewyork_us] [socrata] | agrees |
| q51 | 200 | [data_cityofnewyork_us] [socrata] [socrata_pack] | agrees |
| q51 | 1000 | [data_cityofnewyork_us] [socrata] [socrata_0bb5ca] [socrata_2] [socrata_pack] | agrees |
| q30 | 7 | [] | agrees |
| q30 | 50 | [nyc_311] | agrees |
| q30 | 200 | [nyc_311] | agrees |
| q30 | 1000 | [nyc_311] | agrees |
| q127 | 7 | [socrata] | agrees |
| q127 | 50 | [socrata] | agrees |
| q127 | 200 | [fiscalfocus_pittsburghpa_gov] [socrata] [socrata_pack] | agrees |
| q127 | 1000 | [fiscalfocus_pittsburghpa_gov] [socrata] [socrata_0bb5ca] [socrata_2] [socrata_pack] | agrees |
| q129 | 7 | [] | agrees |
| q129 | 50 | [] | agrees |
| q129 | 200 | [] | agrees |
| q129 | 1000 | [govinfo] | agrees |
| q53 | 7 | [] [socrata] | [socrata] |
| q53 | 50 | [] [socrata] | [data_ny_gov] [socrata] |
| q53 | 200 | [] [socrata] [socrata_pack] | [data_ny_gov] [socrata] [socrata_pack] |
| q53 | 1000 | [] [socrata] [socrata_0bb5ca] [socrata_2] [socrata_pack] | [data_ny_gov] [socrata] [socrata_0bb5ca] [socrata_2] [socrata_pack] |
| q75 | 7 | [] | agrees |
| q75 | 50 | [] | agrees |
| q75 | 200 | [data_ca_gov] [data_chhs_ca_gov] | agrees |
| q75 | 1000 | [data_ca_gov] [data_chhs_ca_gov] | agrees |
| q107 | 7 | [socrata] | agrees |
| q107 | 50 | [socrata] | agrees |
| q107 | 200 | [data_wcad_org] [socrata] [socrata_pack] | agrees |
| q107 | 1000 | [data_wcad_org] [socrata] [socrata_0bb5ca] [socrata_2] [socrata_pack] | agrees |
| q143 | 7 | [] [data_commons] | agrees |
| q143 | 50 | [] [data_commons] [data_commons_pack] | agrees |
| q143 | 200 | [] [data_commons] [data_commons_pack] | agrees |
| q143 | 1000 | [] [data_commons] [data_commons_pack] | agrees |
| q142 | 7 | [] | agrees |
| q142 | 50 | [] | agrees |
| q142 | 200 | [] | agrees |
| q142 | 1000 | [] | agrees |
| q55 | 7 | [] | agrees |
| q55 | 50 | [nyc_311] | agrees |
| q55 | 200 | [nyc_311] | agrees |
| q55 | 1000 | [nyc_311] | agrees |

**Agreement on the fixed labels: 113 of 120** (30 questions × 4 sizes): 29 of 30 at 7, 29 of 30 at 50, 28 of 30 at 200, 27 of 30 at 1000.
The changes below, made after the labels were fixed, are counted separately and do not enter this figure.

## The seven disagreements and their resolutions

| Id | Size | Tree 2 (P2) | Second labeller |
|---|---|---|---|
| q53 | 7 | [socrata] | [] [socrata] |
| q53 | 50 | [data_ny_gov] [socrata] | [] [socrata] |
| q53 | 200 | [data_ny_gov] [socrata] [socrata_pack] | [] [socrata] [socrata_pack] |
| q53 | 1000 | [data_ny_gov] [socrata] [socrata_0bb5ca] [socrata_2] [socrata_pack] | [] [socrata] [socrata_0bb5ca] [socrata_2] [socrata_pack] |
| q89 | 1000 | [nys_legislation] | [election_org] [nys_legislation] |
| q103 | 200 | [hicscdata_hawaii_gov] [socrata] [socrata_pack] | [hicscdata_hawaii_gov] [opendata_hawaii_gov] [socrata] [socrata_pack] |
| q103 | 1000 | [election_org] [hicscdata_hawaii_gov] [socrata] [socrata_0bb5ca] [socrata_2] [socrata_pack] | [election_org] [hicscdata_hawaii_gov] [opendata_hawaii_gov] [socrata] [socrata_0bb5ca] [socrata_2] [socrata_pack] |

1. **q53, all four sizes: the question was unclear (reworded and relabelled by both).** Its text, "Which subway lines
   had the most service alerts over the past year?", named no place, while P2 read it as New York City's (its strata
   say `named-city`); the second labeller read it under rule 10, with `[]` and the Socrata server and its copies, and
   no `data_ny_gov`. It is reworded to "Which New York City subway lines had the most service alerts over the past
   year?". q53 is a new question, not one of R5's seed. The second labeller relabelled it under the new text
   (`labels-q53.json`): **that relabel was blind to P2's labels, but not to the question's first wording**. Its labels
   equal P2's at all four sizes, so P2's labels stand under the new text.
2. **q89 at 1,000: both readings are defensible (the union).** "Who represents the 39th District in the New York State
   Senate?": P2 labelled `nys_legislation` only; the second labeller added `election_org`, whose description names
   U.S. "candidates, offices, campaign finance, elections and governments". The label at 1,000 is the union, with a note
   that it is a judgment.
3. **q103 at 200 and 1,000: P2 missed an entry (the second labeller's label).** "Which candidates for governor of
   Hawaii raised the most campaign money in 2022?": the second labeller added `opendata_hawaii_gov`, the State of
   Hawaii's general portal, beside `hicscdata_hawaii_gov`, its Campaign Spending Commission's. By rule 6's first
   sentence a portal pack holds the records of the body that publishes it, as P2 already labelled on q65
   (`data_ny_gov` beside `health_data_ny_gov`) and q75 (`data_ca_gov` beside `data_chhs_ca_gov`).

## Changes made after the labels were fixed

Each change below was made in P2's commit 4, after tree 2 fixed the labels, and is counted apart from the agreement.

**The q53 text**, as resolution 1 says. Its labels do not change.

**The labels**: 5 questions, 8 labels.

| Id | Size | Before (tree 2) | After | Why |
|---|---|---|---|---|
| q89 | 1000 | [nys_legislation] | [election_org] [nys_legislation] | resolution 2; sweep (a), every question that asks who holds an office: q89 is the only one (q102 and q106 already carry `election_org`; q19, q21 and q38 ask for legislation, not an office's holder) |
| q103 | 200 | [hicscdata_hawaii_gov] [socrata] [socrata_pack] | adds [opendata_hawaii_gov] | resolution 3 |
| q103 | 1000 | [election_org] [hicscdata_hawaii_gov] [socrata] [socrata_0bb5ca] [socrata_2] [socrata_pack] | adds [opendata_hawaii_gov] | resolution 3 |
| q117 | 200 | [highways_hidot_hawaii_gov] [socrata] [socrata_pack] | adds [opendata_hawaii_gov] | sweep (b): the State of Hawaii's general portal beside its Department of Transportation's portal |
| q117 | 1000 | [govtribe] [hidot_contracts_data_socrata_com] [highways_hidot_hawaii_gov] [highways_hidot_hawaii_gov_2] [socrata] [socrata_0bb5ca] [socrata_2] [socrata_pack] | adds [opendata_hawaii_gov] | sweep (b), as at 200 |
| q26 | 1000 | [globalgov] [govtribe] [nyc_record] [tender] | [govtribe] [nyc_record] [tender] | the rule 8 sentence below: "193 countries" names no place |
| q118 | 1000 | [globalgov] [tender] | [tender] | the rule 8 sentence below |

Sweep (b) checked every question whose gold holds a subject portal of a government body: q60, q65 and q69 (New York
State's health portal; `data_ny_gov` already in), q66 and q138 (Michigan's school data portal; the State's two general
portals already in), q75 (California; already in), q103 and q117 (Hawaii: changed), q67 (Massachusetts: no general
state portal in any inventory), q100 (the Bureau of Transportation Statistics: the U.S. Department of Transportation's
portal lists 1 dataset, rule 6), q127 (Pittsburgh: no general city portal), q128 (Alaska: no general state portal).
q107 (an appraisal district) and q120 (a regional commission) are bodies of their own, with no parent portal here.

q26 and q118 are not a sweep's. The rule 8 sentence states the practice both labellers shared on q115, but P2's own
labels on these two unsampled questions had counted `globalgov` ("193 countries") as covering every country; they now
follow the sentence.

**The README** (`benchmark/questions/README.md`) gains four sentences, each marked there as added after the labels were
fixed. The first three state a practice both labellers already shared, so that the rules match the labels; the fourth
follows from resolution 3:
- rule 3: `[[]]` means both "load nothing" and "no source in this inventory", told apart by the question's kind and
  its note;
- rule 5: a registry entry whose description names a lookup's record can be the lookup server (both labelled
  `opencity` for q87's next Boston City Council meeting at 1,000);
- rule 8: an entry covering "international" procurement or "193 countries" names no place (both left
  `open_contracting` and `globalgov` out of q115);
- rule 6: the specialized-source clause reaches the specialized sources it names and others like them, not a subject
  portal of a government body, which leaves that government's general portal acceptable beside it.

## The question files after the changes

| File | `canonicalJson` SHA-256 |
|---|---|
| `7.json` | `62b841a6de2703decb2a16ab619190df4523cb1c114eab2f48af3924a8b61a34` |
| `50.json` | `2e395899521f64446fe51dd17d480ddcdedb612554c18f5e0c898a30261b0522` |
| `200.json` | `91dbf2f4abd51a5925624c170ef3a68873b94d54e4c8db244753386a098db9a2` |
| `1000.json` | `34c5aa3140d05bbdea95ae539df335da7b34ad81ce90a793dc37434826422438` |

## The second labeller's files, byte for byte

`labels.json`:

```json
{
  "q57": {
    "7": {
      "acceptable": [
        [
          "socrata"
        ]
      ]
    },
    "50": {
      "acceptable": [
        [
          "data_cityofnewyork_us"
        ],
        [
          "socrata"
        ]
      ]
    },
    "200": {
      "acceptable": [
        [
          "data_cityofnewyork_us"
        ],
        [
          "socrata"
        ],
        [
          "socrata_pack"
        ]
      ]
    },
    "1000": {
      "acceptable": [
        [
          "data_cityofnewyork_us"
        ],
        [
          "socrata"
        ],
        [
          "socrata_0bb5ca"
        ],
        [
          "socrata_2"
        ],
        [
          "socrata_pack"
        ]
      ]
    }
  },
  "q96": {
    "7": {
      "acceptable": [
        [
          "data_commons"
        ]
      ],
      "note": "Judgment: 'Honolulu' is read as one named place, not an ambiguous name, so [] is not added; Data Commons holds the 2020 population for the city and for the City and County alike."
    },
    "50": {
      "acceptable": [
        [
          "data_commons"
        ],
        [
          "data_commons_pack"
        ]
      ],
      "note": "Judgment: 'Honolulu' is read as one named place, not an ambiguous name, so [] is not added; Data Commons holds the 2020 population for the city and for the City and County alike."
    },
    "200": {
      "acceptable": [
        [
          "data_commons"
        ],
        [
          "data_commons_pack"
        ]
      ],
      "note": "Judgment: 'Honolulu' is read as one named place, not an ambiguous name, so [] is not added; Data Commons holds the 2020 population for the city and for the City and County alike."
    },
    "1000": {
      "acceptable": [
        [
          "data_commons"
        ],
        [
          "data_commons_pack"
        ]
      ],
      "note": "Judgment: 'Honolulu' is read as one named place, not an ambiguous name, so [] is not added; Data Commons holds the 2020 population for the city and for the City and County alike."
    }
  },
  "q74": {
    "7": {
      "acceptable": [
        []
      ],
      "note": "No entry holds the City of Winchester's parcel and zoning records: its CKAN portal pack first appears at 200, socrata does not reach a CKAN portal, and boston covers Boston only."
    },
    "50": {
      "acceptable": [
        []
      ],
      "note": "No entry holds the City of Winchester's parcel and zoning records: its CKAN portal pack first appears at 200, socrata does not reach a CKAN portal, and boston covers Boston only."
    },
    "200": {
      "acceptable": [
        [
          "opendata_winchesterva_gov"
        ]
      ]
    },
    "1000": {
      "acceptable": [
        [
          "opendata_winchesterva_gov"
        ]
      ]
    }
  },
  "q87": {
    "7": {
      "acceptable": [
        []
      ],
      "note": "No entry holds the Boston City Council's meeting calendar and agendas: boston's description does not name council meetings, and a dataset of past records does not answer a next-meeting lookup (rule 5)."
    },
    "50": {
      "acceptable": [
        []
      ],
      "note": "No entry holds the Boston City Council's meeting calendar and agendas: boston's description does not name council meetings, and a dataset of past records does not answer a next-meeting lookup (rule 5)."
    },
    "200": {
      "acceptable": [
        []
      ],
      "note": "No entry holds the Boston City Council's meeting calendar and agendas: boston and boston_pack do not name council meetings, and a dataset of past records does not answer a next-meeting lookup (rule 5)."
    },
    "1000": {
      "acceptable": [
        [
          "opencity"
        ]
      ],
      "note": "Judgment: opencity ('City council meetings, transcripts, votes, and documents for U.S. cities') is read under rule 8 as covering Boston's next meeting and its agenda; boston, boston_pack and data_boston_gov are excluded because the next meeting is a calendar lookup (rule 5)."
    }
  },
  "q65": {
    "7": {
      "acceptable": [
        [
          "socrata"
        ]
      ]
    },
    "50": {
      "acceptable": [
        [
          "data_ny_gov"
        ],
        [
          "health_data_ny_gov"
        ],
        [
          "socrata"
        ]
      ],
      "note": "Judgment: hospitals and nursing homes are State health-facility records (rule 4); data_ny_gov, the State's general portal, is taken to hold them beside the health portal health_data_ny_gov, and nothing for New York City (data_cityofnewyork_us, bronx_lehman_cuny_edu) does."
    },
    "200": {
      "acceptable": [
        [
          "data_ny_gov"
        ],
        [
          "health_data_ny_gov"
        ],
        [
          "socrata"
        ],
        [
          "socrata_pack"
        ]
      ],
      "note": "Judgment: hospitals and nursing homes are State health-facility records (rule 4); data_ny_gov, the State's general portal, is taken to hold them beside the health portal health_data_ny_gov, and nothing for New York City (data_cityofnewyork_us, bronx_lehman_cuny_edu) does."
    },
    "1000": {
      "acceptable": [
        [
          "data_ny_gov"
        ],
        [
          "health_data_ny_gov"
        ],
        [
          "socrata"
        ],
        [
          "socrata_0bb5ca"
        ],
        [
          "socrata_2"
        ],
        [
          "socrata_pack"
        ]
      ],
      "note": "Judgment: hospitals and nursing homes are State health-facility records (rule 4); data_ny_gov, the State's general portal, is taken to hold them beside the health portal health_data_ny_gov, and nothing for New York City (data_cityofnewyork_us, bronx_lehman_cuny_edu) does."
    }
  },
  "q69": {
    "7": {
      "acceptable": [
        [
          "socrata"
        ]
      ]
    },
    "50": {
      "acceptable": [
        [
          "data_cityofnewyork_us",
          "data_ny_gov"
        ],
        [
          "data_cityofnewyork_us",
          "health_data_ny_gov"
        ],
        [
          "socrata"
        ]
      ],
      "note": "Judgment: data_ny_gov and health_data_ny_gov are each taken to hold the State's restaurant inspections outside the city; socrata and its copies hold both records and stand alone (rule 2)."
    },
    "200": {
      "acceptable": [
        [
          "data_cityofnewyork_us",
          "data_ny_gov"
        ],
        [
          "data_cityofnewyork_us",
          "health_data_ny_gov"
        ],
        [
          "socrata"
        ],
        [
          "socrata_pack"
        ]
      ],
      "note": "Judgment: data_ny_gov and health_data_ny_gov are each taken to hold the State's restaurant inspections outside the city; socrata and its copies hold both records and stand alone (rule 2)."
    },
    "1000": {
      "acceptable": [
        [
          "data_cityofnewyork_us",
          "data_ny_gov"
        ],
        [
          "data_cityofnewyork_us",
          "health_data_ny_gov"
        ],
        [
          "socrata"
        ],
        [
          "socrata_0bb5ca"
        ],
        [
          "socrata_2"
        ],
        [
          "socrata_pack"
        ]
      ],
      "note": "Judgment: data_ny_gov and health_data_ny_gov are each taken to hold the State's restaurant inspections outside the city; socrata and its copies hold both records and stand alone (rule 2)."
    }
  },
  "q42": {
    "7": {
      "acceptable": [
        []
      ]
    },
    "50": {
      "acceptable": [
        []
      ]
    },
    "200": {
      "acceptable": [
        []
      ]
    },
    "1000": {
      "acceptable": [
        []
      ]
    }
  },
  "q115": {
    "7": {
      "acceptable": [
        []
      ],
      "note": "No entry holds Brazil's federal procurement awards."
    },
    "50": {
      "acceptable": [
        []
      ],
      "note": "No entry holds Brazil's federal procurement awards."
    },
    "200": {
      "acceptable": [
        []
      ],
      "note": "No entry holds Brazil's federal procurement awards; tender covers the UK, EU and US and eu_spain_public_data covers Spain and the EU."
    },
    "1000": {
      "acceptable": [
        [
          "brazil_pncp"
        ],
        [
          "global_procurement_tenders"
        ],
        [
          "pncp"
        ]
      ],
      "note": "Judgment: pncp, brazil_pncp and global_procurement_tenders name Brazil's government tenders or PNCP and are read as holding award winners; open_contracting ('international'), globalgov ('193 countries', open bids only) and selltostate ('60+ countries') do not name Brazil, and no Brazilian federal general portal is listed."
    }
  },
  "q124": {
    "7": {
      "acceptable": [
        [
          "socrata"
        ]
      ]
    },
    "50": {
      "acceptable": [
        [
          "socrata"
        ]
      ]
    },
    "200": {
      "acceptable": [
        [
          "data_nola_gov"
        ],
        [
          "socrata"
        ],
        [
          "socrata_pack"
        ]
      ]
    },
    "1000": {
      "acceptable": [
        [
          "data_nola_gov"
        ],
        [
          "data_nola_gov_2"
        ],
        [
          "socrata"
        ],
        [
          "socrata_0bb5ca"
        ],
        [
          "socrata_2"
        ],
        [
          "socrata_pack"
        ]
      ]
    }
  },
  "q123": {
    "7": {
      "acceptable": [
        [
          "socrata"
        ]
      ]
    },
    "50": {
      "acceptable": [
        [
          "socrata"
        ]
      ]
    },
    "200": {
      "acceptable": [
        [
          "data_kcmo_org"
        ],
        [
          "socrata"
        ],
        [
          "socrata_pack"
        ]
      ]
    },
    "1000": {
      "acceptable": [
        [
          "data_kcmo_org"
        ],
        [
          "socrata"
        ],
        [
          "socrata_0bb5ca"
        ],
        [
          "socrata_2"
        ],
        [
          "socrata_pack"
        ]
      ]
    }
  },
  "q03": {
    "7": {
      "acceptable": [
        [
          "socrata"
        ]
      ]
    },
    "50": {
      "acceptable": [
        [
          "socrata"
        ]
      ]
    },
    "200": {
      "acceptable": [
        [
          "socrata"
        ],
        [
          "socrata_pack"
        ]
      ]
    },
    "1000": {
      "acceptable": [
        [
          "socrata"
        ],
        [
          "socrata_0bb5ca"
        ],
        [
          "socrata_2"
        ],
        [
          "socrata_pack"
        ]
      ]
    }
  },
  "q102": {
    "7": {
      "acceptable": [
        []
      ],
      "note": "No entry holds Ohio's 2024 U.S. Senate election results; Data Commons is not taken to hold election returns."
    },
    "50": {
      "acceptable": [
        []
      ],
      "note": "No entry holds Ohio's 2024 U.S. Senate election results; Data Commons is not taken to hold election returns."
    },
    "200": {
      "acceptable": [
        []
      ],
      "note": "No entry holds Ohio's 2024 U.S. Senate election results; Data Commons is not taken to hold election returns."
    },
    "1000": {
      "acceptable": [
        [
          "election_org"
        ]
      ]
    }
  },
  "q14": {
    "7": {
      "acceptable": [
        [
          "boston"
        ]
      ]
    },
    "50": {
      "acceptable": [
        [
          "boston"
        ]
      ]
    },
    "200": {
      "acceptable": [
        [
          "boston"
        ],
        [
          "boston_pack"
        ]
      ]
    },
    "1000": {
      "acceptable": [
        [
          "boston"
        ],
        [
          "boston_pack"
        ],
        [
          "data_boston_gov"
        ]
      ]
    }
  },
  "q122": {
    "7": {
      "acceptable": [
        [
          "socrata"
        ]
      ],
      "note": "Judgment: the Staten Island Ferry is run by New York City, not the MTA, so its ridership is the City's record; data_ny_gov and nyc_mta are excluded."
    },
    "50": {
      "acceptable": [
        [
          "data_cityofnewyork_us"
        ],
        [
          "socrata"
        ]
      ],
      "note": "Judgment: the Staten Island Ferry is run by New York City, not the MTA, so its ridership is the City's record; data_ny_gov and nyc_mta are excluded."
    },
    "200": {
      "acceptable": [
        [
          "data_cityofnewyork_us"
        ],
        [
          "socrata"
        ],
        [
          "socrata_pack"
        ]
      ],
      "note": "Judgment: the Staten Island Ferry is run by New York City, not the MTA, so its ridership is the City's record; data_ny_gov and nyc_mta are excluded."
    },
    "1000": {
      "acceptable": [
        [
          "data_cityofnewyork_us"
        ],
        [
          "socrata"
        ],
        [
          "socrata_0bb5ca"
        ],
        [
          "socrata_2"
        ],
        [
          "socrata_pack"
        ]
      ],
      "note": "Judgment: the Staten Island Ferry is run by New York City, not the MTA, so its ridership is the City's record; data_ny_gov and nyc_mta are excluded."
    }
  },
  "q139": {
    "7": {
      "acceptable": [
        [
          "socrata"
        ]
      ]
    },
    "50": {
      "acceptable": [
        [
          "socrata"
        ]
      ]
    },
    "200": {
      "acceptable": [
        [
          "data_brla_gov"
        ],
        [
          "socrata"
        ],
        [
          "socrata_pack"
        ]
      ]
    },
    "1000": {
      "acceptable": [
        [
          "data_batonrouge"
        ],
        [
          "data_brla_gov"
        ],
        [
          "data_brla_gov_2"
        ],
        [
          "socrata"
        ],
        [
          "socrata_0bb5ca"
        ],
        [
          "socrata_2"
        ],
        [
          "socrata_pack"
        ]
      ]
    }
  },
  "q39": {
    "7": {
      "acceptable": [
        []
      ]
    },
    "50": {
      "acceptable": [
        []
      ]
    },
    "200": {
      "acceptable": [
        []
      ]
    },
    "1000": {
      "acceptable": [
        []
      ]
    }
  },
  "q16": {
    "7": {
      "acceptable": [
        []
      ],
      "note": "No entry holds the City Council's discretionary awards: nyc_budget is not in this inventory and nyc_checkbook excludes them."
    },
    "50": {
      "acceptable": [
        [
          "nyc_budget"
        ]
      ],
      "note": "Judgment: nyc_council's 'legislative data' is not read as holding the Council's discretionary awards, which nyc_budget names; data_cityofnewyork_us is excluded by the specialized-source clause (socrata does not name them), and nyc_checkbook excludes them."
    },
    "200": {
      "acceptable": [
        [
          "nyc_budget"
        ]
      ],
      "note": "Judgment: nyc_council's 'legislative data' is not read as holding the Council's discretionary awards, which nyc_budget names; data_cityofnewyork_us is excluded by the specialized-source clause (socrata does not name them), and nyc_checkbook excludes them."
    },
    "1000": {
      "acceptable": [
        [
          "nyc_budget"
        ]
      ],
      "note": "Judgment: nyc_council's 'legislative data' is not read as holding the Council's discretionary awards, which nyc_budget names; data_cityofnewyork_us is excluded by the specialized-source clause (socrata does not name them), and nyc_checkbook excludes them."
    }
  },
  "q103": {
    "7": {
      "acceptable": [
        [
          "socrata"
        ]
      ]
    },
    "50": {
      "acceptable": [
        [
          "socrata"
        ]
      ]
    },
    "200": {
      "acceptable": [
        [
          "hicscdata_hawaii_gov"
        ],
        [
          "opendata_hawaii_gov"
        ],
        [
          "socrata"
        ],
        [
          "socrata_pack"
        ]
      ],
      "note": "Judgment: opendata_hawaii_gov, the State of Hawaii's general portal, is taken to hold the Campaign Spending Commission's records (rule 6), beside the Commission's own portal."
    },
    "1000": {
      "acceptable": [
        [
          "election_org"
        ],
        [
          "hicscdata_hawaii_gov"
        ],
        [
          "opendata_hawaii_gov"
        ],
        [
          "socrata"
        ],
        [
          "socrata_0bb5ca"
        ],
        [
          "socrata_2"
        ],
        [
          "socrata_pack"
        ]
      ],
      "note": "Judgment: opendata_hawaii_gov, the State of Hawaii's general portal, is taken to hold the Campaign Spending Commission's records (rule 6); election_org covers U.S. campaign finance under rule 8 and is not read as a specialized source that displaces a state portal."
    }
  },
  "q89": {
    "7": {
      "acceptable": [
        [
          "nys_legislation"
        ]
      ]
    },
    "50": {
      "acceptable": [
        [
          "nys_legislation"
        ]
      ]
    },
    "200": {
      "acceptable": [
        [
          "nys_legislation"
        ]
      ]
    },
    "1000": {
      "acceptable": [
        [
          "election_org"
        ],
        [
          "nys_legislation"
        ]
      ],
      "note": "Judgment: election_org ('candidates, offices, campaign finance, elections and governments' for the U.S.) is read as holding who holds a State Senate seat; data_ny_gov is excluded because nys_legislation is the specialized source for members and socrata does not name them."
    }
  },
  "q45": {
    "7": {
      "acceptable": [
        [],
        [
          "socrata"
        ]
      ],
      "note": "Rule 10: no place is named, so [] (ask which place) and any entry covering pothole reports for many places (socrata and its copies) are acceptable."
    },
    "50": {
      "acceptable": [
        [],
        [
          "socrata"
        ]
      ],
      "note": "Rule 10: no place is named, so [] (ask which place) and any entry covering pothole reports for many places (socrata and its copies) are acceptable."
    },
    "200": {
      "acceptable": [
        [],
        [
          "socrata"
        ],
        [
          "socrata_pack"
        ]
      ],
      "note": "Rule 10: no place is named, so [] (ask which place) and any entry covering pothole reports for many places (socrata and its copies) are acceptable."
    },
    "1000": {
      "acceptable": [
        [],
        [
          "socrata"
        ],
        [
          "socrata_0bb5ca"
        ],
        [
          "socrata_2"
        ],
        [
          "socrata_pack"
        ]
      ],
      "note": "Rule 10: no place is named, so [] (ask which place) and any entry covering pothole reports for many places (socrata and its copies) are acceptable."
    }
  },
  "q51": {
    "7": {
      "acceptable": [
        [
          "socrata"
        ]
      ]
    },
    "50": {
      "acceptable": [
        [
          "data_cityofnewyork_us"
        ],
        [
          "socrata"
        ]
      ]
    },
    "200": {
      "acceptable": [
        [
          "data_cityofnewyork_us"
        ],
        [
          "socrata"
        ],
        [
          "socrata_pack"
        ]
      ]
    },
    "1000": {
      "acceptable": [
        [
          "data_cityofnewyork_us"
        ],
        [
          "socrata"
        ],
        [
          "socrata_0bb5ca"
        ],
        [
          "socrata_2"
        ],
        [
          "socrata_pack"
        ]
      ]
    }
  },
  "q30": {
    "7": {
      "acceptable": [
        []
      ],
      "note": "No entry holds New York City's alternate side parking calendar: nyc_311 is not in this inventory, and a dataset is not taken to answer a calendar lookup (rule 5)."
    },
    "50": {
      "acceptable": [
        [
          "nyc_311"
        ]
      ]
    },
    "200": {
      "acceptable": [
        [
          "nyc_311"
        ]
      ]
    },
    "1000": {
      "acceptable": [
        [
          "nyc_311"
        ]
      ]
    }
  },
  "q127": {
    "7": {
      "acceptable": [
        [
          "socrata"
        ]
      ]
    },
    "50": {
      "acceptable": [
        [
          "socrata"
        ]
      ]
    },
    "200": {
      "acceptable": [
        [
          "fiscalfocus_pittsburghpa_gov"
        ],
        [
          "socrata"
        ],
        [
          "socrata_pack"
        ]
      ]
    },
    "1000": {
      "acceptable": [
        [
          "fiscalfocus_pittsburghpa_gov"
        ],
        [
          "socrata"
        ],
        [
          "socrata_0bb5ca"
        ],
        [
          "socrata_2"
        ],
        [
          "socrata_pack"
        ]
      ]
    }
  },
  "q129": {
    "7": {
      "acceptable": [
        []
      ],
      "note": "No entry holds federal law (the text of 47 U.S.C. 230); nyc_charter and nys_legislation exclude federal law."
    },
    "50": {
      "acceptable": [
        []
      ],
      "note": "No entry holds federal law (the text of 47 U.S.C. 230); nyc_charter and nys_legislation exclude federal law."
    },
    "200": {
      "acceptable": [
        []
      ],
      "note": "No entry holds federal law (the text of 47 U.S.C. 230); nyc_charter and nys_legislation exclude federal law."
    },
    "1000": {
      "acceptable": [
        [
          "govinfo"
        ]
      ],
      "note": "Judgment: govinfo ('full text of US government publications') is taken to hold the U.S. Code; edgrapi_skills ('Congress') does not name statute text."
    }
  },
  "q53": {
    "7": {
      "acceptable": [
        [],
        [
          "socrata"
        ]
      ],
      "note": "Rule 10, judgment: no place is named and several cities have subways, so [] and socrata and its copies are acceptable; data_ny_gov (the MTA's alert history, rule 4) covers one place, and nyc_mta reports only today's alerts (rule 5)."
    },
    "50": {
      "acceptable": [
        [],
        [
          "socrata"
        ]
      ],
      "note": "Rule 10, judgment: no place is named and several cities have subways, so [] and socrata and its copies are acceptable; data_ny_gov (the MTA's alert history, rule 4) covers one place, and nyc_mta reports only today's alerts (rule 5)."
    },
    "200": {
      "acceptable": [
        [],
        [
          "socrata"
        ],
        [
          "socrata_pack"
        ]
      ],
      "note": "Rule 10, judgment: no place is named and several cities have subways, so [] and socrata and its copies are acceptable; data_ny_gov (the MTA's alert history, rule 4) covers one place, and nyc_mta reports only today's alerts (rule 5)."
    },
    "1000": {
      "acceptable": [
        [],
        [
          "socrata"
        ],
        [
          "socrata_0bb5ca"
        ],
        [
          "socrata_2"
        ],
        [
          "socrata_pack"
        ]
      ],
      "note": "Rule 10, judgment: no place is named and several cities have subways, so [] and socrata and its copies are acceptable; data_ny_gov (the MTA's alert history, rule 4) covers one place, and nyc_mta reports only today's alerts (rule 5)."
    }
  },
  "q75": {
    "7": {
      "acceptable": [
        []
      ],
      "note": "No entry holds California's Medi-Cal enrollment records; Data Commons is not taken to hold a state program's enrollment count."
    },
    "50": {
      "acceptable": [
        []
      ],
      "note": "No entry holds California's Medi-Cal enrollment records; Data Commons is not taken to hold a state program's enrollment count."
    },
    "200": {
      "acceptable": [
        [
          "data_ca_gov"
        ],
        [
          "data_chhs_ca_gov"
        ]
      ],
      "note": "Judgment: Medi-Cal enrollment is a State of California program record, held by the health and human services portal and by the State's general portal data_ca_gov; Data Commons is not taken to hold a program enrollment count."
    },
    "1000": {
      "acceptable": [
        [
          "data_ca_gov"
        ],
        [
          "data_chhs_ca_gov"
        ]
      ],
      "note": "Judgment: Medi-Cal enrollment is a State of California program record, held by the health and human services portal and by the State's general portal data_ca_gov; Data Commons is not taken to hold a program enrollment count."
    }
  },
  "q107": {
    "7": {
      "acceptable": [
        [
          "socrata"
        ]
      ]
    },
    "50": {
      "acceptable": [
        [
          "socrata"
        ]
      ]
    },
    "200": {
      "acceptable": [
        [
          "data_wcad_org"
        ],
        [
          "socrata"
        ],
        [
          "socrata_pack"
        ]
      ]
    },
    "1000": {
      "acceptable": [
        [
          "data_wcad_org"
        ],
        [
          "socrata"
        ],
        [
          "socrata_0bb5ca"
        ],
        [
          "socrata_2"
        ],
        [
          "socrata_pack"
        ]
      ]
    }
  },
  "q143": {
    "7": {
      "acceptable": [
        [],
        [
          "data_commons"
        ]
      ],
      "note": "Rule 10: 'Springfield' fits many places, so [] (ask which) and Data Commons and its wrapper are acceptable."
    },
    "50": {
      "acceptable": [
        [],
        [
          "data_commons"
        ],
        [
          "data_commons_pack"
        ]
      ],
      "note": "Rule 10: 'Springfield' fits many places, so [] (ask which) and Data Commons and its wrapper are acceptable."
    },
    "200": {
      "acceptable": [
        [],
        [
          "data_commons"
        ],
        [
          "data_commons_pack"
        ]
      ],
      "note": "Rule 10: 'Springfield' fits many places, so [] (ask which) and Data Commons and its wrapper are acceptable."
    },
    "1000": {
      "acceptable": [
        [],
        [
          "data_commons"
        ],
        [
          "data_commons_pack"
        ]
      ],
      "note": "Rule 10: 'Springfield' fits many places, so [] (ask which) and Data Commons and its wrapper are acceptable."
    }
  },
  "q142": {
    "7": {
      "acceptable": [
        []
      ]
    },
    "50": {
      "acceptable": [
        []
      ]
    },
    "200": {
      "acceptable": [
        []
      ]
    },
    "1000": {
      "acceptable": [
        []
      ]
    }
  },
  "q55": {
    "7": {
      "acceptable": [
        []
      ],
      "note": "No entry holds New York City's daily service status: nyc_311 is not in this inventory, and a dataset is not taken to answer a today lookup (rule 5)."
    },
    "50": {
      "acceptable": [
        [
          "nyc_311"
        ]
      ]
    },
    "200": {
      "acceptable": [
        [
          "nyc_311"
        ]
      ]
    },
    "1000": {
      "acceptable": [
        [
          "nyc_311"
        ]
      ]
    }
  }
}
```

`labels-q53.json`:

```json
{
  "q53": {
    "7": {
      "acceptable": [
        [
          "socrata"
        ]
      ],
      "note": "Judgment: the subway's past service alerts are taken as MTA historical records like its outage history, so they are New York State's (rule 4) and sit on data.ny.gov; nyc_mta reports only today's alerts (rule 5), data_cityofnewyork_us holds the City's records, and the specialized-source clause is read as not touching the State's portal."
    },
    "50": {
      "acceptable": [
        [
          "data_ny_gov"
        ],
        [
          "socrata"
        ]
      ],
      "note": "Judgment: the subway's past service alerts are taken as MTA historical records like its outage history, so they are New York State's (rule 4) and sit on data.ny.gov; nyc_mta reports only today's alerts (rule 5), data_cityofnewyork_us holds the City's records, and the specialized-source clause is read as not touching the State's portal."
    },
    "200": {
      "acceptable": [
        [
          "data_ny_gov"
        ],
        [
          "socrata"
        ],
        [
          "socrata_pack"
        ]
      ],
      "note": "Judgment: the subway's past service alerts are taken as MTA historical records like its outage history, so they are New York State's (rule 4) and sit on data.ny.gov; nyc_mta reports only today's alerts (rule 5), data_cityofnewyork_us holds the City's records, and the specialized-source clause is read as not touching the State's portal."
    },
    "1000": {
      "acceptable": [
        [
          "data_ny_gov"
        ],
        [
          "socrata"
        ],
        [
          "socrata_0bb5ca"
        ],
        [
          "socrata_2"
        ],
        [
          "socrata_pack"
        ]
      ],
      "note": "Judgment: the subway's past service alerts are taken as MTA historical records like its outage history, so they are New York State's (rule 4) and sit on data.ny.gov; nyc_mta reports only today's alerts (rule 5), data_cityofnewyork_us holds the City's records, and the specialized-source clause is read as not touching the State's portal."
    }
  }
}
```
