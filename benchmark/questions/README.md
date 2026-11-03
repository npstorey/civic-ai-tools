# The question set and its gold

The benchmark's questions, labelled against each frozen inventory (Sprint S1, hub #302). Every question is in all four
files with the same id, text, kind and strata; only `acceptable` and `note` differ by size, because each file is
labelled against its own inventory.

| File | Labelled against |
|---|---|
| `7.json` | `benchmark/inventories/7.json` |
| `50.json` | `benchmark/inventories/50.json` |
| `200.json` | `benchmark/inventories/200.json` |
| `1000.json` | `benchmark/inventories/1000.json` |

Each file is `{ schema, inventory, note, probeIds, questions }`, validated by `schema.json`. `inventory` names the
inventory by path, id, version and `canonicalJson` SHA-256. Every value is a string, an array or an object (the router's
`canonicalJson`, which hashes the file, refuses numbers, booleans and null). Beside each file, `<n>.json.sha256` is the
SHA-256 of the router's `canonicalJson` of the parsed file, as the inventories have.

The rules below were written before any label, and the second labeller was given this file verbatim as it then stood.
Four sentences, each marked, were added after the labels were fixed and the second labelling was resolved;
`labelling.md` records that labelling, its resolutions and every change made after it.

## A question

`{ id, kind, text, strata: { place, category, sources, trap }, acceptable: [[...], ...], note? }`

- **`kind`**, as R5 named them: `single` (one record answers it), `two` (it needs two records), `none` (no data source is
  needed) and `ambiguous` (a place or a reading is open, so more than one first move is right).
- **`strata.place`**: `named-city` (a city or another local government: a county, a borough, a regional body),
  `named-state` (a US state or territory, or a state or province elsewhere), `federal` (the United States as a whole or
  a federal agency, or another country as a whole), `no-place` (no place is needed), `ambiguous-place` (a place is needed
  and none is named, or the name fits more than one place).
- **`strata.category`**: the design's nine (`311-service-requests`, `permits-inspections`, `budget-spending`,
  `procurement`, `legislation-law`, `transit` (transit and transportation), `census-statistics`, `elections`,
  `property`), and two more: `other` (civic records outside the nine: public safety, health, education, environment,
  public notices) and `none` (no record is asked for). A question that needs two records takes the first one's.
- **`strata.sources`**: `"0"`, `"1"` or `"2"`: how many records the question needs, whatever the inventory holds (for
  a question with several readings, the fewest any reading needs). A question whose record no entry holds still needs
  one, and a comparison of two places' records needs two, though one entry may hold both.
- **`strata.trap`**: `none`, or one of the design's five trap types:
  - `counting-vs-lookup`: one entry looks up single records (a request by its number, today's alerts) and another
    holds the dataset that counts them; the question asks for one of the two.
  - `state-portal-vs-city-server`: the record is kept by a state body, so it sits on the state's portal, though the
    question names a city that has its own server or portal.
  - `pack-vs-base`: the answer turns on how a pack differs from its base: its filter fixes one portal, its base reaches
    others or does not reach the pack's portal, or both answer.
  - `same-category-two-jurisdictions`: the inventory holds the same kind of record for two jurisdictions a model could
    confuse (a city and its state, a county and its city, two legislatures), and the question names one.
  - `distractor-match`: an entry that does not answer matches the question's words better than the gold's
    description does.

A trap is the question's, so it is the same in every file, though the entry that sets it may first appear at a larger
size.

## The labelling rules

You label each question once for each inventory: 7, 50, 200 and 1,000 entries. Each inventory is a JSON file whose
`entries` each carry an `alias`, a `displayName`, a `description`, a `place`, and, for a pack, its `base`, `filter`
and `catalog`. A larger inventory holds every entry of the smaller ones unchanged, under the same alias.

**1. An acceptable set.** A label is a list of acceptable sets. An acceptable set is a set of aliases from that
inventory whose loads, together, answer the whole question, judged from the entries as that inventory describes them.
A set is minimal: no alias in it can be dropped and the rest still answer. List every acceptable set. Write each set's
aliases in ascending order; the order of the sets does not matter. Label against the inventory's entries, not against
what any configuration lists or configures.

**2. Several sets.** Several sets are acceptable when different entries hold the same record (a server and a portal
pack for that portal; an entry and its copy, rule 9) or when the question can be read more than one way (rule 10). A
question that needs two records, each held by several entries, has one set for every combination of one holder per
record. An entry that holds both records is a set on its own; it is never combined with a second holder.

**3. `[]`, and "no source in this inventory".** The empty set `[]` means "load nothing". It is acceptable when the
question needs no data source (a definition, arithmetic, a note to write), and under rule 10. When no set of this
inventory's entries answers the whole question, the label is `[[]]`: no source in this inventory. A question that needs
two records, one of which no entry holds, is `[[]]` too: loading the other answers only half of it. So `[[]]` means
both "load nothing" (a question of kind `none`) and "no source in this inventory"; the question's kind and its note tell
them apart. (Added after the labels were fixed; see `labelling.md`.)

**4. Who keeps the record.** Decide first which government or body keeps the record asked for; an entry holds a record
only if it holds that keeper's records.
- A city keeps its 311 requests, building permits and code inspections, its payroll, contracts, payments and budget,
  and its restaurant inspections where its own health department does them.
- A county keeps what its own offices do: assessments, county permits, and the inspections its health department
  runs.
- A state keeps vehicle and driver records, business registrations, professional and liquor licenses, its lottery,
  hospital and health-facility records, state taxes and what it pays out to cities, its own spending, contracts and
  payroll, and the records of state authorities. New York's MTA is a state authority: its ridership, its bridge and
  tunnel traffic and its historical outage records are New York State's.
- A federal agency keeps its own records.
- A statistical series (population, income, poverty, unemployment, education, health rates, commuting, rents as the
  census measures them) is held by an entry whose description names the agency or kind of source that produces it,
  such as Google Data Commons for the Census Bureau, BLS and CDC. A portal pack is not taken to hold a statistical series
  unless its name says it holds statistics.

**5. A server.** A server (`kind: "server"`) holds what its description says, for the places it names, and nothing its
description excludes. "Cannot reach Boston's city data", "holds no census statistics" and "has no figures for
neighborhoods" each rule a record out. A server that looks up single records does not count them, and one that reports
today's state does not hold history. The reverse holds too: a lookup of one record by its number, or of today's state
(an alert, an outage, a calendar), is the lookup server's, and a dataset of past records is not taken to answer it. A
registry entry whose description names that lookup's record (a council's meetings, say) can be the lookup server, under
rule 8. (Added after the labels were fixed; see `labelling.md`.)

**6. A portal pack and its base.** A portal pack (`kind: "pack"` with a `filter.portal`) is its base server's tools
fixed to one portal. It holds the records of the body that publishes that portal (its description names the publisher
and its `place`), with three exceptions:
- a portal whose name or address confines it to one subject holds only that subject: a performance, finance (open
  finance, financial, checkbook, transparency, expenditures), police, health, school, COVID-19, GIS or sustainability
  portal;
- a portal whose description lists fewer than 10 datasets holds only what its name states (a "Contracts Data Catalog"
  holds contracts; a "San Francisco Open Data Portal" with 4 datasets holds nothing in particular);
- a portal at a vendor's demonstration address (`*.demo.socrata.com`), or published by the platform's vendor, holds
  nothing.

Two packs that each hold the record (two addresses of one city's portal) are each acceptable.

A specialized source comes first. When an entry of the 1,000-entry inventory is described as holding a kind of record
for a place (New York City's spending, contracts and payroll in Checkbook NYC; the City Record's notices; the City
Council's legislation and its discretionary awards), a general portal of that place holds that kind of record only if
its base's description names it. The `socrata` server's description names 311 requests, building permits,
inspections, crime, housing violations, payroll, licenses and transit ridership; a Socrata portal pack follows its
base. This holds in every inventory, including one that does not list the specialized source. The clause reaches the
specialized sources it names and others like them; it does not reach a subject portal of a government body (a state's
health department or campaign spending commission), which leaves that government's general portal acceptable beside
it. (Added after the labels were fixed; see `labelling.md`.)

The base. The `socrata` server reaches every Socrata portal, so it is acceptable wherever a Socrata portal pack would
be, in every inventory, including one in which that portal has no pack. Whether a record is on a Socrata portal is read
from the Socrata packs of the 1,000-entry inventory (it lists every Socrata portal in its catalog that names a country)
and from the server's own description (New York City, Chicago, San Francisco, Seattle, Los Angeles, data.ny.gov). The
CKAN packs' base, Boston OpenContext (`boston`), covers the City of Boston only: it is acceptable for a CKAN pack's
record only when that pack's portal is Boston's. A pack and its base are alternative sets, `[["socrata"],
["data_cityofnewyork_us"]]`, never one set holding both.

**7. A CKAN pack** (base `boston-opencontext`) is labelled as rule 6 says. Its `hosting: "container"` (no instance runs
a generic CKAN server) does not change its label.

**8. A registry entry** (`tools: "not-captured"`; a load returns no tools) is labelled from its description alone, as a
server is, when the description says where it applies:
- it names the place asked about, or a portal that holds the record (an entry naming `data.lacity.org` holds what
  that portal holds);
- or it names the country without a narrower list ("U.S. ... elections", "US federal procurement"), or says it covers
  every place of its kind ("any city", "all 50 states"): it covers that record at every such place;
- an entry that queries Socrata portals in general, naming none, is labelled as the `socrata` server is.

A list of some places that does not name the one asked about ("9 US cities", "a growing list of cities") does not
cover it. An entry covering "international" procurement or "193 countries" names no place. (Added after the labels were fixed; see `labelling.md`.) The entry
must name the record asked for, or a portal that holds it. A load of a registry entry is scored on
the first request only; that does not change its label.

**9. Copies** (`synthetic: "true"`). A near-duplicate (`distractor.kind: "near-duplicate"`) is a copy of a real entry
(`distractor.of`) with reworded text and the same tools; a wrapper (`distractor.kind: "wrapper"`) is a pack over a
server with no argument fixed and the server's tools. Each holds what its original holds, so it is acceptable wherever
its original is, as an alternative set, never in the same set as its original.

**10. Open places and readings.** When a question needs a place and names none, or names one that fits several
places, `[]` (asking which place) is acceptable, and so is any one entry whose description covers that record for many
places (the `socrata` server and the entries rule 6, 8 or 9 labels as it; Data Commons for a statistical series). An
entry that covers one place is not. When a question can be read as asking for different records, each reading's sets
are acceptable; a reading that asks for both records has its own sets, which hold the other readings' sets (rule 1's
minimality is within a reading).

**11. Notes.** A `note`, one or two sentences, is required when a label rests on a judgment these rules do not settle
(say which); when the label is `[[]]` because no entry in this inventory holds a record the question needs (say which
record is missing); when a question is labelled under rule 10; and, for R5's seed questions (q01 to q49), when the label
differs from R5's (say what changed and why; `build.mjs` writes this clause from R5's labels). R5 labelled against its own eleven-entry directory: its aliases
`socrata`, `data_commons`, `boston`, `nyc_charter`, `nyc_checkbook`, `nyc_record`, `nys_legislation`, `nyc_311`,
`nyc_mta`, `nyc_budget` and `nyc_council` are the entries of the same aliases here.

## How the files are made

`benchmark/questions/build.mjs` writes the four files and their hashes from `gold.mjs`, where each question's text,
kind and strata are written once and its gold is written as the records it needs and the entries that hold each, over
the 1,000-entry inventory's aliases. A file's label is that gold kept to the entries of its own inventory, expanded by
rules 2, 3 and 10: one holder per record, `[[]]` where a record has no holder. `node benchmark/questions/build.mjs
--check` rebuilds the four files and their hashes byte for byte.
