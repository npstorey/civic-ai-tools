// The benchmark's questions and their gold, written once (README.md, "How the
// files are made"). build.mjs keeps each question's gold to the entries of
// each inventory and writes the four files.
//
// A question: { id, kind, text, strata, readings, ask?, note?, notes?, r5? }
//   readings  the ways the question can be answered, each a list of the
//             records it needs; each record names itself and lists every alias
//             of the 1,000-entry inventory that holds it, by the README's rules
//   ask       true where asking which place is a correct first move (rule 10)
//   note      a note at every size; notes, a note by size: "7" at that size
//             only, "200+" at that size and larger
//   r5        for a seed question whose label departs from R5's by a judgment
//             rather than by what the inventory holds: why
//
// Written from the world, not from the inventories' descriptions: each
// question asks what a resident, reporter or analyst asks, and the holders
// are then found by the rules. R5's 49 questions (q01 to q49) keep their ids,
// texts and kinds.

// --- Holders: aliases of the 1,000-entry inventory, by what they hold -------

/** The Socrata server, its near-duplicate and wrapper, and the registry entry
 *  that queries Socrata portals in general (rules 6, 8 and 9). */
const SOC = ['socrata', 'socrata_2', 'socrata_pack', 'socrata_0bb5ca'];
const DC = ['data_commons', 'data_commons_pack'];
const BOS = ['boston', 'boston_pack', 'data_boston_gov'];
const CHK = ['nyc_checkbook', 'nyc_checkbook_pack'];
const COUNCIL = ['nyc_council', 'opencity'];
const NYC = [...SOC, 'data_cityofnewyork_us'];
const NYS = [...SOC, 'data_ny_gov'];
const NYS_HEALTH = [...NYS, 'health_data_ny_gov'];
const CHI = [...SOC, 'data_cityofchicago_org', 'chicago_socrata_com'];
const AUS = ['datahub_austintexas_gov'];
const GOVTRIBE = ['govtribe'];

/** A record a question needs, and its holders. */
const R = (record, ...holders) => ({ record, holders: holders.flat() });
/** A question with one reading. */
const one = (...records) => [records];

const S = (place, category, sources, trap = 'none') => ({ place, category, sources, trap });

export const PROBE_IDS = ['q11', 'q34', 'q39'];

const SEED = [
  {
    id: 'q01',
    kind: 'single',
    text: 'How many building permits did Chicago issue in 2025?',
    strata: S('named-city', 'permits-inspections', '1'),
    readings: one(R("Chicago's building permits", CHI)),
  },
  {
    id: 'q02',
    kind: 'single',
    text: 'What were the most common restaurant inspection violations in New York City last year?',
    strata: S('named-city', 'permits-inspections', '1'),
    readings: one(R("New York City's restaurant inspections", NYC)),
  },
  {
    id: 'q03',
    kind: 'single',
    text: 'How many car break-ins were reported in San Francisco in the past six months?',
    strata: S('named-city', 'other', '1'),
    readings: one(R("San Francisco's crime reports", SOC)),
    notes: { '200+': 'data_sf_gov lists 4 datasets, so it holds nothing in particular (rule 6).' },
  },
  {
    id: 'q04',
    kind: 'single',
    text: 'Which Seattle neighborhoods had the most code compliance complaints this year?',
    strata: S('named-city', 'permits-inspections', '1'),
    readings: one(R("Seattle's code compliance complaints", SOC, 'data_seattle')),
    notes: {
      '50+': 'performance_seattle_gov is a performance portal (rule 6).',
      1000: 'data_seattle_gov lists 0 datasets (rule 6); data_seattle names data.seattle.gov (rule 8).',
    },
  },
  {
    id: 'q05',
    kind: 'single',
    text: 'How many noise complaints did New York City 311 receive last month?',
    strata: S('named-city', '311-service-requests', '1', 'counting-vs-lookup'),
    readings: one(R("New York City's 311 requests, counted", NYC)),
    note: "Counting complaints needs the 311 dataset on NYC Open Data; nyc_311 only looks up requests by number (R5's note).",
  },
  {
    id: 'q06',
    kind: 'single',
    text: 'What was average weekday subway ridership in New York in 2025?',
    strata: S('named-city', 'transit', '1', 'state-portal-vs-city-server'),
    readings: one(R("the MTA's ridership, on data.ny.gov", NYS)),
    note: "MTA ridership is published on data.ny.gov, a Socrata portal; nyc_mta covers alerts, outages and station lookup only (R5's note).",
  },
  {
    id: 'q07',
    kind: 'single',
    text: 'What is the median household income in Cuyahoga County, Ohio?',
    strata: S('named-city', 'census-statistics', '1'),
    readings: one(R('county income statistics', DC)),
  },
  {
    id: 'q08',
    kind: 'single',
    text: 'How has the unemployment rate in Texas changed over the last ten years?',
    strata: S('named-state', 'census-statistics', '1', 'distractor-match'),
    readings: one(R('state unemployment statistics', DC)),
    notes: { '50+': 'data_texas_gov names Texas, but a portal pack is not taken to hold a statistical series (rule 4).' },
  },
  {
    id: 'q09',
    kind: 'single',
    text: "What share of adults in Mississippi have a bachelor's degree?",
    strata: S('named-state', 'census-statistics', '1', 'distractor-match'),
    readings: one(R('state education statistics', DC)),
    notes: { '200+': "data_mmcp_ms_gov names Mississippi but is the state's medical cannabis program." },
  },
  {
    id: 'q10',
    kind: 'single',
    text: "How many pothole requests did Boston's 311 receive last month?",
    strata: S('named-city', '311-service-requests', '1'),
    readings: one(R("Boston's 311 requests", BOS)),
  },
  {
    id: 'q11',
    kind: 'single',
    text: 'What does the New York City Charter say about the powers of the Public Advocate?',
    strata: S('named-city', 'legislation-law', '1'),
    readings: one(R('the New York City Charter', 'nyc_charter')),
  },
  {
    id: 'q12',
    kind: 'single',
    text: 'Which section of the NYC Administrative Code covers noise from construction sites?',
    strata: S('named-city', 'legislation-law', '1'),
    readings: one(R("New York City's Administrative Code", 'nyc_charter')),
  },
  {
    id: 'q13',
    kind: 'single',
    text: 'What do the Rules of the City of New York require of a restaurant that wants to operate a sidewalk cafe?',
    strata: S('named-city', 'legislation-law', '1'),
    readings: one(R('the Rules of the City of New York', 'nyc_charter')),
  },
  {
    id: 'q14',
    kind: 'single',
    text: 'Which Boston neighborhoods had the most building permits issued in 2025?',
    strata: S('named-city', 'permits-inspections', '1'),
    readings: one(R("Boston's building permits", BOS)),
  },
  {
    id: 'q15',
    kind: 'single',
    text: 'What is the average assessed value of residential properties in Dorchester?',
    strata: S('named-city', 'property', '1'),
    readings: one(R("Boston's property assessments", BOS)),
  },
  {
    id: 'q16',
    kind: 'single',
    text: 'Which organizations received City Council discretionary funding in Queens in fiscal year 2025?',
    strata: S('named-city', 'budget-spending', '1'),
    readings: one(R("the New York City Council's discretionary awards", 'nyc_budget')),
    notes: { 7: "nyc_checkbook's description excludes Council discretionary awards." },
  },
  {
    id: 'q17',
    kind: 'single',
    text: 'List the Council discretionary awards to the Brooklyn Public Library since fiscal year 2020.',
    strata: S('named-city', 'budget-spending', '1'),
    readings: one(R("the New York City Council's discretionary awards", 'nyc_budget')),
    notes: { 7: "nyc_checkbook's description excludes Council discretionary awards." },
  },
  {
    id: 'q18',
    kind: 'single',
    text: 'What capital project changes did the City Council make under Section 254 in fiscal year 2024?',
    strata: S('named-city', 'budget-spending', '1'),
    readings: one(R("the New York City Council's Section 254 capital changes", 'nyc_budget')),
  },
  {
    id: 'q19',
    kind: 'single',
    text: 'Who sponsored Int. 0001-2024 in the New York City Council, and what is its status?',
    strata: S('named-city', 'legislation-law', '1', 'same-category-two-jurisdictions'),
    readings: one(R("the New York City Council's legislation", COUNCIL)),
    notes: {
      7: "nys_legislation covers New York State's legislature, not the City Council's.",
      1000: 'opencity covers city council meetings, votes and documents for U.S. cities (rule 8).',
    },
  },
  {
    id: 'q20',
    kind: 'single',
    text: "When is the next hearing of the City Council's Committee on Housing and Buildings?",
    strata: S('named-city', 'legislation-law', '1'),
    readings: one(R("the New York City Council's committee hearings", COUNCIL)),
    notes: { 1000: 'opencity covers city council meetings, votes and documents for U.S. cities (rule 8).' },
  },
  {
    id: 'q21',
    kind: 'single',
    text: 'What bills has the Council member for District 39 sponsored this session?',
    strata: S('named-city', 'legislation-law', '1', 'same-category-two-jurisdictions'),
    readings: one(R("the New York City Council's legislation", COUNCIL)),
    notes: { 1000: 'opencity covers city council meetings, votes and documents for U.S. cities (rule 8).' },
  },
  {
    id: 'q22',
    kind: 'single',
    text: 'What is the status of New York State Senate bill S1234 in the 2025-2026 session?',
    strata: S('named-state', 'legislation-law', '1', 'same-category-two-jurisdictions'),
    readings: one(R("New York State's bills", 'nys_legislation')),
  },
  {
    id: 'q23',
    kind: 'single',
    text: 'Which bills in the New York State Assembly this session deal with rent stabilization?',
    strata: S('named-state', 'legislation-law', '1'),
    readings: one(R("New York State's bills", 'nys_legislation')),
  },
  {
    id: 'q24',
    kind: 'single',
    text: 'What does section 120.05 of the New York State Penal Law say?',
    strata: S('named-state', 'legislation-law', '1'),
    readings: one(R("New York State's consolidated laws", 'nys_legislation')),
  },
  {
    id: 'q25',
    kind: 'single',
    text: 'What public hearings have been announced in the City Record this week?',
    strata: S('named-city', 'other', '1'),
    readings: one(R("the City Record's notices", 'nyc_record')),
  },
  {
    id: 'q26',
    kind: 'single',
    text: 'Which open procurement solicitations has the NYC Department of Transportation published?',
    strata: S('named-city', 'procurement', '1'),
    readings: one(R("New York City's open solicitations", 'nyc_record', 'tender', 'globalgov', GOVTRIBE)),
    notes: {
      '200+': 'tender covers US procurement opportunities (rule 8).',
      1000: 'globalgov covers open tenders in 193 countries, and govtribe U.S. federal, state and local procurement (rule 8).',
    },
  },
  {
    id: 'q27',
    kind: 'single',
    text: 'How much did the City of New York pay its ten largest vendors in fiscal year 2025?',
    strata: S('named-city', 'budget-spending', '1'),
    readings: one(R("New York City's payments to vendors", CHK)),
  },
  {
    id: 'q28',
    kind: 'single',
    text: 'What active contracts does the NYC Department of Sanitation hold, and what are they worth?',
    strata: S('named-city', 'procurement', '1'),
    readings: one(R("New York City's contracts", CHK, GOVTRIBE)),
    notes: { 1000: 'govtribe covers U.S. federal, state and local procurement (rule 8).' },
  },
  {
    id: 'q29',
    kind: 'single',
    text: 'How much has New York City spent with Verizon this fiscal year?',
    strata: S('named-city', 'budget-spending', '1'),
    readings: one(R("New York City's payments to vendors", CHK)),
  },
  {
    id: 'q30',
    kind: 'single',
    text: 'Is alternate side parking in effect in New York City tomorrow?',
    strata: S('named-city', '311-service-requests', '1'),
    readings: one(R("NYC 311's city-services calendar", 'nyc_311')),
  },
  {
    id: 'q31',
    kind: 'single',
    text: 'What is the status of NYC 311 service request 311-12345678?',
    strata: S('named-city', '311-service-requests', '1', 'counting-vs-lookup'),
    readings: one(R('a lookup of one NYC 311 request by its number', 'nyc_311')),
    note: 'A lookup by number is the lookup server\'s; the 311 dataset on NYC Open Data is not taken to answer it (rule 5).',
  },
  {
    id: 'q32',
    kind: 'single',
    text: 'Are New York City public schools open on Monday?',
    strata: S('named-city', '311-service-requests', '1'),
    readings: one(R("NYC 311's city-services calendar", 'nyc_311')),
  },
  {
    id: 'q33',
    kind: 'single',
    text: 'Are there any service alerts on the L train right now?',
    strata: S('named-city', 'transit', '1'),
    readings: one(R("today's subway service alerts", 'nyc_mta')),
  },
  {
    id: 'q34',
    kind: 'two',
    text: 'Do Boston neighborhoods with more 311 complaints have lower median household incomes?',
    strata: S('named-city', '311-service-requests', '2'),
    readings: one(R("Boston's 311 requests", BOS), R('income statistics', DC)),
    note: "Judgment: Data Commons has no neighborhood figures, but its census-tract series can be aggregated to Boston's neighborhoods, so R5's label is kept.",
  },
  {
    id: 'q35',
    kind: 'single',
    text: 'Which subway station elevators in Manhattan are out of service today?',
    strata: S('named-city', 'transit', '1', 'counting-vs-lookup'),
    readings: one(R("today's subway elevator outages", 'nyc_mta')),
    note: "Today's outages are the lookup server's; the MTA's past outage records on data.ny.gov are not taken to answer it (rule 5).",
  },
  {
    id: 'q36',
    kind: 'two',
    text: "Compare Chicago's annual building permit counts with its population growth over the past five years.",
    strata: S('named-city', 'permits-inspections', '2'),
    readings: one(R("Chicago's building permits", CHI), R('population statistics', DC)),
  },
  {
    id: 'q37',
    kind: 'two',
    text: 'What does the NYC Administrative Code require of sidewalk cafes, and how many sidewalk cafe licenses are active in the city now?',
    strata: S('named-city', 'legislation-law', '2'),
    readings: one(R("New York City's Administrative Code", 'nyc_charter'), R("New York City's licenses", NYC)),
  },
  {
    id: 'q38',
    kind: 'two',
    text: 'Which Council members sponsored the most bills last year, and how much discretionary funding did each of them allocate in fiscal year 2026?',
    strata: S('named-city', 'legislation-law', '2'),
    readings: one(R("the New York City Council's legislation", COUNCIL), R("the New York City Council's discretionary awards", 'nyc_budget')),
  },
  {
    id: 'q39',
    kind: 'none',
    text: 'What is the difference between a median and a mean?',
    strata: S('no-place', 'none', '0'),
    readings: [],
    ask: true,
  },
  {
    id: 'q40',
    kind: 'two',
    text: 'Which procurement awards did the NYC Department of Sanitation announce in the City Record this year, and how much has the city paid those vendors so far?',
    strata: S('named-city', 'procurement', '2'),
    readings: one(R("the City Record's award notices", 'nyc_record'), R("New York City's payments to vendors", CHK)),
  },
  {
    id: 'q41',
    kind: 'two',
    text: 'How does the poverty rate in the Bronx compare with the number of housing maintenance violations issued there last year?',
    strata: S('named-city', 'census-statistics', '2', 'distractor-match'),
    readings: one(R('county poverty statistics', DC), R("New York City's housing maintenance violations", NYC)),
    notes: { '50+': "bronx_lehman_cuny_edu, Lehman College's Bronx portal, holds neither the statistics nor the City's violations (rules 4 and 6)." },
  },
  {
    id: 'q42',
    kind: 'none',
    text: 'Write a two-sentence thank-you note to volunteers who cleaned up a neighborhood park.',
    strata: S('no-place', 'none', '0'),
    readings: [],
    ask: true,
  },
  {
    id: 'q43',
    kind: 'none',
    text: 'How do I convert a percentage into a decimal?',
    strata: S('no-place', 'none', '0'),
    readings: [],
    ask: true,
  },
  {
    id: 'q44',
    kind: 'none',
    text: 'In one paragraph, what is open data?',
    strata: S('no-place', 'none', '0'),
    readings: [],
    ask: true,
  },
  {
    id: 'q45',
    kind: 'ambiguous',
    text: 'How many potholes were reported last year?',
    strata: S('ambiguous-place', '311-service-requests', '1'),
    readings: one(R("some place's pothole reports", SOC)),
    ask: true,
    note: 'No place is named: asking which, or loading an entry that covers pothole reports for many places, is acceptable (rule 10).',
    r5: 'R5 also accepted boston, which covers one city, and rule 10 does not',
  },
  {
    id: 'q46',
    kind: 'ambiguous',
    text: 'How much is New York City spending on parks?',
    strata: S('named-city', 'budget-spending', '1'),
    readings: [one(R("New York City's spending", CHK))[0], one(R("the New York City Council's discretionary awards", 'nyc_budget'))[0], one(R("New York City's spending", CHK), R("the New York City Council's discretionary awards", 'nyc_budget'))[0]],
    note: "Read as the City's spending (Checkbook NYC), as the Council's discretionary awards to parks groups, or as both (rule 10).",
  },
  {
    id: 'q47',
    kind: 'ambiguous',
    text: 'What laws govern street vendors in New York City?',
    strata: S('named-city', 'legislation-law', '1'),
    readings: [
      [R("New York City's own law", 'nyc_charter')],
      [R("New York City's own law", 'nyc_charter'), R("the New York City Council's pending legislation", COUNCIL)],
      [R("New York City's own law", 'nyc_charter'), R("New York State's laws", 'nys_legislation')],
    ],
    note: "Read as the City's law, the City's law with the Council's pending bills, or the City's law with the State's (rule 10).",
  },
  {
    id: 'q48',
    kind: 'ambiguous',
    text: 'What is the average salary of an NYPD police officer?',
    strata: S('named-city', 'budget-spending', '1'),
    readings: [[R("New York City's payroll", CHK)], [R("New York City's payroll", NYC)]],
    note: 'City payroll is on Checkbook NYC and on NYC Open Data (Citywide Payroll) (R5\'s note).',
  },
  {
    id: 'q49',
    kind: 'ambiguous',
    text: 'What contracts did the NYC Department of Sanitation award recently?',
    strata: S('named-city', 'procurement', '1'),
    readings: [
      [R("the City Record's award notices", 'nyc_record', GOVTRIBE)],
      [R("New York City's registered contracts", CHK, GOVTRIBE)],
      [R("the City Record's award notices", 'nyc_record'), R("New York City's registered contracts", CHK)],
    ],
    note: 'Award notices are in the City Record; registered contracts are in Checkbook NYC (R5\'s note).',
    notes: { 1000: 'govtribe covers U.S. federal, state and local procurement (rule 8).' },
  },
];

// --- New questions (q50 on) ------------------------------------------------

const NEW = [
  // Counting versus lookup.
  {
    kind: 'single',
    text: 'How many 311 complaints about illegally parked cars were filed in Brooklyn last month?',
    strata: S('named-city', '311-service-requests', '1', 'counting-vs-lookup'),
    readings: one(R("New York City's 311 requests, counted", NYC)),
  },
  {
    kind: 'single',
    text: 'How many 311 complaints about no heat or hot water did New York City receive last winter?',
    strata: S('named-city', '311-service-requests', '1', 'counting-vs-lookup'),
    readings: one(R("New York City's 311 requests, counted", NYC)),
  },
  {
    kind: 'single',
    text: 'How many elevator and escalator outages did New York City subway stations have in 2025?',
    strata: S('named-city', 'transit', '1', 'counting-vs-lookup'),
    readings: one(R("the MTA's past outage records, on data.ny.gov", NYS)),
    note: "nyc_mta reports today's outages, not a year's (rule 5); the MTA's records are New York State's (rule 4).",
  },
  {
    kind: 'single',
    text: 'Which subway lines had the most service alerts over the past year?',
    strata: S('named-city', 'transit', '1', 'counting-vs-lookup'),
    readings: one(R("the MTA's past service alerts, on data.ny.gov", NYS)),
    note: "nyc_mta reports today's alerts, not a year's (rule 5); the MTA's records are New York State's (rule 4).",
  },
  {
    kind: 'single',
    text: 'Is the A train running with delays right now?',
    strata: S('named-city', 'transit', '1', 'counting-vs-lookup'),
    readings: one(R("today's subway service alerts", 'nyc_mta')),
  },
  {
    kind: 'single',
    text: 'Is garbage collection on its normal schedule in New York City today?',
    strata: S('named-city', '311-service-requests', '1', 'counting-vs-lookup'),
    readings: one(R("NYC 311's service status for today", 'nyc_311')),
  },
  {
    kind: 'single',
    text: 'Are there any planned service changes on the Q train this weekend?',
    strata: S('named-city', 'transit', '1', 'counting-vs-lookup'),
    readings: one(R("the subway's current service alerts", 'nyc_mta')),
  },
  {
    kind: 'single',
    text: 'How many 311 complaints about rats were reported in Manhattan in 2025?',
    strata: S('named-city', '311-service-requests', '1', 'counting-vs-lookup'),
    readings: one(R("New York City's 311 requests, counted", NYC)),
  },

  // A state portal versus a city server.
  {
    kind: 'single',
    text: 'How many electric vehicles are registered in Seattle?',
    strata: S('named-city', 'other', '1', 'state-portal-vs-city-server'),
    readings: one(R("Washington State's vehicle registrations", SOC, 'data_wa_gov', 'data_wa')),
  },
  {
    kind: 'single',
    text: 'How many active liquor licenses are there in Brooklyn?',
    strata: S('named-city', 'permits-inspections', '1', 'state-portal-vs-city-server'),
    readings: one(R("New York State's liquor licenses", NYS)),
  },
  {
    kind: 'single',
    text: 'How many patients were discharged from hospitals in Manhattan in 2023?',
    strata: S('named-city', 'other', '1', 'state-portal-vs-city-server'),
    readings: one(R("New York State's hospital discharge records", NYS_HEALTH)),
  },
  {
    kind: 'single',
    text: 'How much sales tax revenue did the State of Texas send to the City of Austin last year?',
    strata: S('named-city', 'budget-spending', '1', 'state-portal-vs-city-server'),
    readings: one(R("Texas's sales tax allocations to cities", SOC, 'data_texas_gov', 'data_texas_gov_2')),
  },
  {
    kind: 'single',
    text: 'How many homes in Hartford, Connecticut, sold for more than $500,000 last year?',
    strata: S('named-city', 'property', '1', 'state-portal-vs-city-server'),
    readings: one(R("Connecticut's statewide real estate sales records", SOC, 'data_ct_gov', 'data_connecticut')),
    note: "Judgment: a town records its own deeds, and the State publishes every town's sales on data.ct.gov.",
    notes: { 1000: 'data_hartford_gov lists 0 datasets (rule 6).' },
  },
  {
    kind: 'single',
    text: 'How many new corporations were registered in Queens last year?',
    strata: S('named-city', 'permits-inspections', '1', 'state-portal-vs-city-server'),
    readings: one(R("New York State's business registrations", NYS)),
  },
  {
    kind: 'single',
    text: 'How many vehicles crossed the Verrazzano-Narrows Bridge last month?',
    strata: S('named-city', 'transit', '1', 'state-portal-vs-city-server'),
    readings: one(R("the MTA's bridge and tunnel traffic, on data.ny.gov", NYS)),
  },
  {
    kind: 'single',
    text: 'How many state-licensed hospitals and nursing homes are there in the Bronx?',
    strata: S('named-city', 'permits-inspections', '1', 'state-portal-vs-city-server'),
    readings: one(R("New York State's health facility records", NYS_HEALTH)),
  },
  {
    kind: 'single',
    text: 'How many students were enrolled in each Detroit public school last year?',
    strata: S('named-city', 'other', '1', 'state-portal-vs-city-server'),
    readings: one(R("Michigan's school enrollment records", SOC, 'mischooldata_data_socrata_com', 'mischooldata_data_socrata_com_2', 'data_michigan_gov', 'future_michigan_gov')),
    notes: { '200+': 'detroitdata_org is published by a civil-society group, not the City or the State (rule 6).' },
  },
  {
    kind: 'single',
    text: 'How much did the Commonwealth of Massachusetts pay vendors based in Boston last year?',
    strata: S('named-city', 'budget-spending', '1', 'state-portal-vs-city-server'),
    readings: one(R('Massachusetts state payments', SOC, 'cthru_data_socrata_com')),
  },
  {
    kind: 'single',
    text: 'How many licensed electricians are there in Austin, Texas?',
    strata: S('named-city', 'permits-inspections', '1', 'state-portal-vs-city-server'),
    readings: one(R("Texas's professional licenses", SOC, 'data_texas_gov', 'data_texas_gov_2')),
    notes: { 1000: 'contractor_license verifies one license at a time and does not count them (rule 5).' },
  },

  // A pack versus its base.
  {
    kind: 'two',
    text: 'Compare the number of restaurant inspections New York City did last year with the number New York State did in the rest of the state.',
    strata: S('named-city', 'permits-inspections', '2', 'pack-vs-base'),
    readings: [
      [R('both portals', SOC)],
      [R("New York City's restaurant inspections", 'data_cityofnewyork_us'), R("New York State's food service inspections", 'data_ny_gov', 'health_data_ny_gov')],
    ],
    note: 'The socrata server reaches both portals; a pack reaches only its own, so the packs answer only as a pair (rules 2 and 6).',
  },
  {
    kind: 'two',
    text: 'Which city issued more building permits in 2025, Chicago or Austin?',
    strata: S('named-city', 'permits-inspections', '2', 'pack-vs-base'),
    readings: [[R('both portals', SOC)], [R("Chicago's building permits", 'data_cityofchicago_org', 'chicago_socrata_com'), R("Austin's building permits", AUS)]],
    note: 'The socrata server reaches both portals; a pack reaches only its own, so the packs answer only as a pair (rules 2 and 6).',
  },
  {
    kind: 'single',
    text: 'Which Boston neighborhoods had the most crime incidents reported in 2025?',
    strata: S('named-city', 'other', '1', 'pack-vs-base'),
    readings: one(R("Boston's crime incidents", BOS)),
  },
  {
    kind: 'single',
    text: 'How many vehicles did traffic counters record on Champaign County roads last year?',
    strata: S('named-city', 'transit', '1', 'pack-vs-base'),
    readings: one(R("the Champaign County Regional Planning Commission's traffic counts", 'data_ccrpc_org')),
    note: "Judgment: the county's regional planning commission keeps its traffic counts.",
    notes: { '200+': "boston, the CKAN packs' base, covers Boston only (rule 6)." },
  },
  {
    kind: 'single',
    text: 'How many fire and medical calls did Pompano Beach, Florida, respond to last year?',
    strata: S('named-city', 'other', '1', 'pack-vs-base'),
    readings: one(R("Pompano Beach's fire rescue records", 'data_pompanobeachfl_gov')),
    notes: { '200+': "boston, the CKAN packs' base, covers Boston only (rule 6)." },
  },
  {
    kind: 'single',
    text: 'Which parcels in Winchester, Virginia, are zoned for commercial use?',
    strata: S('named-city', 'property', '1', 'pack-vs-base'),
    readings: one(R("Winchester's zoning", 'opendata_winchesterva_gov')),
    notes: { '200+': "boston, the CKAN packs' base, covers Boston only (rule 6)." },
  },
  {
    kind: 'single',
    text: 'How many people in Fresno County are enrolled in Medi-Cal?',
    strata: S('named-city', 'other', '1', 'pack-vs-base'),
    readings: one(R("California's Medi-Cal enrollment records", 'data_chhs_ca_gov', 'data_ca_gov')),
    note: "Medi-Cal enrollment is the State's record, not a statistical series a Data Commons description names (rule 4).",
    notes: { '200+': "Both California portals are the State's (rule 6); boston, the CKAN packs' base, covers Boston only." },
  },
  {
    kind: 'single',
    text: 'How much did the City of New York pay Con Edison in fiscal year 2025?',
    strata: S('named-city', 'budget-spending', '1', 'pack-vs-base'),
    readings: one(R("New York City's payments to vendors", CHK)),
  },
  {
    kind: 'two',
    text: 'How many building permits did Cambridge and Somerville, Massachusetts, each issue in 2025?',
    strata: S('named-city', 'permits-inspections', '2', 'pack-vs-base'),
    readings: [[R('both portals', SOC)], [R("Cambridge's building permits", 'data_cambridgema_gov', 'data_cambridgema_gov_2'), R("Somerville's building permits", 'data_somervillema_gov')]],
    note: 'The socrata server reaches both portals; a pack reaches only its own, so the packs answer only as a pair (rules 2 and 6).',
  },
  {
    kind: 'two',
    text: 'Compare the number of 311 service requests Oakland and Los Angeles received in 2025.',
    strata: S('named-city', '311-service-requests', '2', 'pack-vs-base'),
    readings: [[R('both portals', SOC)], [R("Oakland's 311 requests", 'data_oaklandca_gov', 'data_oaklandca_gov_2', 'data_oakland'), R("Los Angeles's 311 requests", 'data_lacity_org', 'data_la')]],
    note: 'The socrata server reaches both portals; a pack reaches only its own, so the packs answer only as a pair (rules 2 and 6).',
  },
  {
    kind: 'single',
    text: 'How many people work for the State of Oklahoma, by agency?',
    strata: S('named-state', 'budget-spending', '1', 'pack-vs-base'),
    readings: one(R("Oklahoma's state payroll", 'data_ok_gov')),
    notes: { '200+': "boston, the CKAN packs' base, covers Boston only (rule 6)." },
  },
  {
    kind: 'single',
    text: "What were Hawaii's state government revenues in 2024?",
    strata: S('named-state', 'budget-spending', '1', 'pack-vs-base'),
    readings: one(R("Hawaii's state finances", 'opendata_hawaii_gov')),
    notes: { '200+': "boston, the CKAN packs' base, covers Boston only (rule 6)." },
  },

  // The same category in two jurisdictions.
  {
    kind: 'single',
    text: 'How many building permits did Cook County issue for unincorporated areas in 2024?',
    strata: S('named-city', 'permits-inspections', '1', 'same-category-two-jurisdictions'),
    readings: one(R("Cook County's permits", SOC, 'datacatalog_cookcountyil_gov', 'cookcounty_data_socrata_com', 'data_cookcounty')),
    notes: { '200+': 'performance_cookcountyil_gov is at a performance address (rule 6).' },
  },
  {
    kind: 'single',
    text: 'How many restaurant inspections did Montgomery County, Maryland, carry out last year?',
    strata: S('named-city', 'permits-inspections', '1', 'same-category-two-jurisdictions'),
    readings: one(R("Montgomery County's food inspections", SOC, 'data_montgomerycountymd_gov')),
  },
  {
    kind: 'single',
    text: 'How many 311 requests did Kansas City, Kansas, receive last year?',
    strata: S('named-city', '311-service-requests', '1', 'same-category-two-jurisdictions'),
    readings: one(R("Kansas City, Kansas's 311 requests")),
    notes: { '200+': "data_kcmo_org is Kansas City, Missouri's portal." },
  },
  {
    kind: 'single',
    text: 'Which bills about congestion pricing did the New York City Council introduce in 2023?',
    strata: S('named-city', 'legislation-law', '1', 'same-category-two-jurisdictions'),
    readings: one(R("the New York City Council's legislation", COUNCIL)),
    notes: { 1000: 'opencity covers city council meetings, votes and documents for U.S. cities (rule 8).' },
  },
  {
    kind: 'single',
    text: 'What does New York State law require employers to pay fast food workers?',
    strata: S('named-state', 'legislation-law', '1', 'same-category-two-jurisdictions'),
    readings: one(R("New York State's consolidated laws", 'nys_legislation')),
  },
  {
    kind: 'single',
    text: "What does New York City's own law say about minimum pay for app-based food delivery workers?",
    strata: S('named-city', 'legislation-law', '1', 'same-category-two-jurisdictions'),
    readings: one(R("New York City's own law", 'nyc_charter')),
  },
  {
    kind: 'single',
    text: 'When does the Boston City Council next meet, and what is on its agenda?',
    strata: S('named-city', 'legislation-law', '1', 'same-category-two-jurisdictions'),
    readings: one(R("the Boston City Council's meetings", 'opencity')),
    note: "boston's description names no council records, and nyc_council is New York City's.",
    notes: { 1000: 'opencity covers city council meetings, votes and documents for U.S. cities (rule 8).' },
  },
  {
    kind: 'single',
    text: 'How much did Fulton County, Georgia, spend on its jail last year?',
    strata: S('named-city', 'budget-spending', '1', 'same-category-two-jurisdictions'),
    readings: one(R("Fulton County's spending", SOC, 'data_fultoncountyga_gov')),
    notes: { '200+': "sharefulton_fultoncountyga_gov is the county Board of Health's, performance_fultoncountyga_gov is a performance portal, and atlanta_data_socrata_com is the City of Atlanta's (rule 6)." },
  },
  {
    kind: 'single',
    text: 'Who represents the 39th District in the New York State Senate?',
    strata: S('named-state', 'legislation-law', '1', 'same-category-two-jurisdictions'),
    readings: one(R("New York State's legislators", 'nys_legislation')),
  },
  {
    kind: 'single',
    text: "Which Prince George's County roads had the most pothole repair requests in 2025?",
    strata: S('named-city', '311-service-requests', '1', 'same-category-two-jurisdictions'),
    readings: one(R("Prince George's County's service requests", SOC, 'data_princegeorgescountymd_gov')),
    notes: { '50+': "performance_princegeorges_55dd30 is a performance portal (rule 6)." },
  },

  // A distractor's description matches better.
  {
    kind: 'single',
    text: 'What letter grades did Manhattan restaurants receive in their most recent health inspections?',
    strata: S('named-city', 'permits-inspections', '1', 'distractor-match'),
    readings: one(R("New York City's restaurant inspections", NYC)),
    notes: { '50+': "health_data_ny_gov is the State Department of Health's portal; the City's own health department grades its restaurants (rule 4)." },
  },
  {
    kind: 'single',
    text: 'What is the median gross rent in Boston?',
    strata: S('named-city', 'census-statistics', '1', 'distractor-match'),
    readings: one(R('rent statistics', DC)),
    note: "boston's description says it holds no census statistics.",
  },
  {
    kind: 'single',
    text: 'What share of Seattle residents were born outside the United States?',
    strata: S('named-city', 'census-statistics', '1', 'distractor-match'),
    readings: one(R('population statistics', DC)),
  },
  {
    kind: 'single',
    text: "What was New Jersey's unemployment rate in 2025?",
    strata: S('named-state', 'census-statistics', '1', 'distractor-match'),
    readings: one(R('state unemployment statistics', DC)),
    notes: { '200+': "jersey_opendata is the Channel Island of Jersey's portal, and data_nj_gov is not taken to hold a statistical series (rule 4)." },
  },
  {
    kind: 'single',
    text: 'How much did New York City spend on NYPD overtime in fiscal year 2025?',
    strata: S('named-city', 'budget-spending', '1', 'distractor-match'),
    readings: one(R("New York City's payroll", CHK, NYC)),
    note: "nyc_budget holds the Council's discretionary funding, not agency spending; payroll is in Checkbook NYC and on NYC Open Data.",
  },
  {
    kind: 'single',
    text: 'What was the population of Honolulu in 2020?',
    strata: S('named-city', 'census-statistics', '1', 'distractor-match'),
    readings: one(R('population statistics', DC)),
  },
  {
    kind: 'single',
    text: 'How many veterans in Texas receive VA disability compensation?',
    strata: S('named-state', 'other', '1', 'distractor-match'),
    readings: one(R("veterans' disability compensation", SOC, 'www_datahub_va_gov', DC)),
    note: "Judgment: the VA keeps the benefit records, and the census measures veterans' service-connected disability ratings by state; data_texas_gov holds neither.",
  },
  {
    kind: 'single',
    text: 'How many Section 8 housing vouchers are in use in Baltimore?',
    strata: S('named-city', 'other', '1', 'distractor-match'),
    readings: one(R("the federal housing voucher program's records")),
    notes: { 1000: "data_baltimore holds the City of Baltimore's open data; the vouchers are not the City's records (rule 4)." },
  },
  {
    kind: 'single',
    text: "What is the average commute time for residents of Prince George's County, Maryland?",
    strata: S('named-city', 'census-statistics', '1', 'distractor-match'),
    readings: one(R('commuting statistics', DC)),
    notes: { '50+': "performance_princegeorges_55dd30 is a performance portal and not a statistical series (rules 4 and 6)." },
  },
  {
    kind: 'single',
    text: 'Which U.S. airports had the most delayed flights in 2025?',
    strata: S('federal', 'transit', '1', 'distractor-match'),
    readings: one(R("the Bureau of Transportation Statistics' flight records", SOC, 'data_bts_gov')),
    notes: { 1000: 'flight_fares and flightoracle search fares, not delay records.' },
  },

  // Elections.
  {
    kind: 'single',
    text: 'How many registered voters are there in each Boston ward?',
    strata: S('named-city', 'elections', '1'),
    readings: one(R("Boston's election records", BOS)),
  },
  {
    kind: 'single',
    text: 'Who won the 2024 U.S. Senate election in Ohio, and by how many votes?',
    strata: S('named-state', 'elections', '1'),
    readings: one(R('U.S. election results', 'election_org')),
    notes: { 1000: 'election_org covers U.S. elections (rule 8).' },
  },
  {
    kind: 'single',
    text: 'Which candidates for governor of Hawaii raised the most campaign money in 2022?',
    strata: S('named-state', 'elections', '1'),
    readings: one(R("Hawaii's campaign finance records", SOC, 'hicscdata_hawaii_gov', 'election_org')),
    notes: { 1000: 'election_org covers U.S. campaign finance (rule 8).' },
  },
  {
    kind: 'single',
    text: "How many votes did each candidate receive in Boston's 2025 preliminary municipal election?",
    strata: S('named-city', 'elections', '1'),
    readings: one(R("Boston's election results", BOS, 'election_org')),
    notes: { 1000: 'election_org covers U.S. elections (rule 8).' },
  },
  {
    kind: 'single',
    text: 'How many people voted in the 2024 presidential election in each state?',
    strata: S('federal', 'elections', '1'),
    readings: one(R('U.S. election results', 'election_org')),
    notes: { 1000: 'election_org covers U.S. elections (rule 8).' },
  },
  {
    kind: 'single',
    text: 'Who is running for New York City Council in District 5 this year?',
    strata: S('named-city', 'elections', '1'),
    readings: one(R('U.S. election candidates', 'election_org')),
    note: 'nyc_council holds the Council\'s legislation, not its candidates.',
    notes: { 1000: 'election_org covers U.S. candidates (rule 8).' },
  },

  // Property.
  {
    kind: 'single',
    text: 'Which homes in Williamson County, Texas, had the largest increases in appraised value this year?',
    strata: S('named-city', 'property', '1'),
    readings: one(R("the Williamson Central Appraisal District's appraisals", SOC, 'data_wcad_org')),
  },
  {
    kind: 'single',
    text: 'How many residential properties sold in Connecticut in 2023, and at what median price?',
    strata: S('named-state', 'property', '1'),
    readings: one(R("Connecticut's statewide real estate sales records", SOC, 'data_ct_gov', 'data_connecticut')),
  },
  {
    kind: 'single',
    text: 'What were the median assessed values of homes in each Cook County township last year?',
    strata: S('named-city', 'property', '1'),
    readings: one(R("Cook County's assessments", SOC, 'datacatalog_cookcountyil_gov', 'cookcounty_data_socrata_com', 'data_cookcounty')),
  },
  {
    kind: 'single',
    text: 'What is the median rent for an apartment in Dubai Marina?',
    strata: S('named-city', 'property', '1'),
    readings: one(R("Dubai's real estate records", 'dubairealestatedata', 'dubai_land')),
  },
  {
    kind: 'single',
    text: 'How many vacant lots does the City of Cleveland own?',
    strata: S('named-city', 'property', '1'),
    readings: one(R("Cleveland's property records")),
  },
  {
    kind: 'single',
    text: 'Which buildings in New York City have the most open housing code violations?',
    strata: S('named-city', 'property', '1'),
    readings: one(R("New York City's housing violations", NYC)),
  },

  // Procurement.
  {
    kind: 'single',
    text: 'Which defense contractors received the largest federal contract awards last month?',
    strata: S('federal', 'procurement', '1'),
    readings: one(R('federal contract awards', 'gov_contracts', 'edgrapi_skills', 'global_procurement_tenders', GOVTRIBE)),
    notes: { '200+': 'tender lists procurement opportunities, not awards.' },
  },
  {
    kind: 'single',
    text: 'What contracts has the City of Austin awarded for road construction since 2024?',
    strata: S('named-city', 'procurement', '1'),
    readings: one(R("Austin's contracts", SOC, AUS, GOVTRIBE)),
    notes: { 1000: 'govtribe covers U.S. federal, state and local procurement (rule 8).' },
  },
  {
    kind: 'single',
    text: 'Which companies won Brazilian federal government tenders this month?',
    strata: S('federal', 'procurement', '1'),
    readings: one(R("Brazil's public procurement awards", 'brazil_pncp', 'pncp', 'global_procurement_tenders')),
    notes: { 1000: 'open_contracting and selltostate do not name Brazil, and globalgov lists tenders still open (rule 8).' },
  },
  {
    kind: 'single',
    text: "Which companies is the NYC Parks Department planning to give contracts to, according to this month's public notices?",
    strata: S('named-city', 'procurement', '1'),
    readings: one(R("the City Record's intent-to-award notices", 'nyc_record')),
  },
  {
    kind: 'single',
    text: 'What highway construction contracts has the Hawaii Department of Transportation awarded since 2024?',
    strata: S('named-state', 'procurement', '1'),
    readings: one(R("the Hawaii Department of Transportation's contracts", SOC, 'highways_hidot_hawaii_gov', 'highways_hidot_hawaii_gov_2', 'hidot_contracts_data_socrata_com', GOVTRIBE)),
    notes: { 1000: 'hidot_contracts_data_socrata_com lists 2 datasets and its name states contracts; govtribe covers U.S. state procurement (rules 6 and 8).' },
  },
  {
    kind: 'single',
    text: 'Which UK local councils have open tenders for waste collection services?',
    strata: S('federal', 'procurement', '1'),
    readings: one(R("the UK's open public tenders", 'tender', 'globalgov')),
    notes: { '200+': 'tender covers UK procurement opportunities (rule 8).', 1000: 'globalgov covers open tenders in 193 countries (rule 8).' },
  },

  // Transit.
  {
    kind: 'single',
    text: 'What was the average weekday ridership on CTA bus route 9 last year?',
    strata: S('named-city', 'transit', '1'),
    readings: one(R("the Chicago Transit Authority's ridership, on Chicago's portal", CHI)),
  },
  {
    kind: 'single',
    text: 'How many trips did riders take on Bay Area transit systems in 2024?',
    strata: S('named-city', 'transit', '1'),
    readings: one(R("the Bay Area's transit ridership", SOC, 'data_bayareametro_gov')),
    note: "Judgment: the region's transportation commission keeps ridership for every operator it funds.",
  },
  {
    kind: 'single',
    text: 'How many taxi trips started at JFK Airport in January 2025?',
    strata: S('named-city', 'transit', '1'),
    readings: one(R("New York City's taxi trip records", NYC)),
  },
  {
    kind: 'single',
    text: 'What is the average daily ridership of the Staten Island Ferry?',
    strata: S('named-city', 'transit', '1'),
    readings: one(R("New York City's ferry ridership", NYC)),
  },

  // 311 and service requests.
  {
    kind: 'single',
    text: 'Which Kansas City, Missouri, neighborhoods had the most 311 complaints about trash pickup last year?',
    strata: S('named-city', '311-service-requests', '1'),
    readings: one(R("Kansas City, Missouri's 311 requests", SOC, 'data_kcmo_org')),
  },
  {
    kind: 'single',
    text: 'How many pothole complaints did New Orleans receive in 2025?',
    strata: S('named-city', '311-service-requests', '1'),
    readings: one(R("New Orleans's 311 requests", SOC, 'data_nola_gov', 'data_nola_gov_2')),
  },

  // Census and statistics.
  {
    kind: 'single',
    text: 'How has the U.S. poverty rate changed since 2010?',
    strata: S('federal', 'census-statistics', '1'),
    readings: one(R('national poverty statistics', DC)),
  },
  {
    kind: 'single',
    text: 'Which U.S. state has the highest share of residents without health insurance?',
    strata: S('federal', 'census-statistics', '1'),
    readings: one(R('health insurance statistics by state', DC)),
  },

  // Budget and spending.
  {
    kind: 'single',
    text: "What was the City of Pittsburgh's general fund revenue in 2024?",
    strata: S('named-city', 'budget-spending', '1'),
    readings: one(R("Pittsburgh's finances", SOC, 'fiscalfocus_pittsburghpa_gov')),
  },
  {
    kind: 'single',
    text: 'How much did the State of Alaska spend on education in fiscal year 2025?',
    strata: S('named-state', 'budget-spending', '1'),
    readings: one(R("Alaska's state spending", SOC, 'stateofalaska_data_socrata_com')),
  },

  // Legislation and law.
  {
    kind: 'single',
    text: 'What does Section 230 of the Communications Decency Act say?',
    strata: S('federal', 'legislation-law', '1'),
    readings: one(R('the text of U.S. federal law', 'govinfo')),
    notes: { 1000: "govinfo holds the full text of U.S. government publications, the U.S. Code among them (rule 8)." },
  },
  {
    kind: 'single',
    text: 'Which bills about artificial intelligence were introduced in the U.S. Congress in 2025?',
    strata: S('federal', 'legislation-law', '1'),
    readings: one(R("the U.S. Congress's bills", 'edgrapi_skills', 'govinfo')),
  },
  {
    kind: 'single',
    text: 'Which climate laws did the Danish parliament pass in 2024?',
    strata: S('federal', 'legislation-law', '1'),
    readings: one(R("the Danish parliament's records", 'folketinget_dk')),
  },
  {
    kind: 'single',
    text: 'Which New Mexico city councils discussed water rights at their meetings this year?',
    strata: S('named-state', 'legislation-law', '1'),
    readings: one(R("New Mexico local governments' meeting records", 'perfect_world')),
  },

  // Permits and inspections.
  {
    kind: 'single',
    text: 'How many building permits did Austin issue for solar panel installations in 2025?',
    strata: S('named-city', 'permits-inspections', '1'),
    readings: one(R("Austin's building permits", SOC, AUS)),
    notes: { 1000: 'data_austintexas_gov lists 0 datasets (rule 6).' },
  },
  {
    kind: 'single',
    text: 'How many dog licenses did New York City issue last year?',
    strata: S('named-city', 'permits-inspections', '1'),
    readings: one(R("New York City's licenses", NYC)),
  },
  {
    kind: 'single',
    text: 'Which Chicago restaurants failed food inspections in 2025?',
    strata: S('named-city', 'permits-inspections', '1'),
    readings: one(R("Chicago's food inspections", CHI)),
  },

  // Other civic records.
  {
    kind: 'single',
    text: 'How many shootings did the Chicago Police Department record in 2025?',
    strata: S('named-city', 'other', '1'),
    readings: one(R("Chicago's crime records", CHI)),
  },
  {
    kind: 'single',
    text: 'How many traffic crashes with injuries happened in New York City in 2025?',
    strata: S('named-city', 'other', '1'),
    readings: one(R("New York City's crash records", NYC)),
  },
  {
    kind: 'single',
    text: 'What is the average teacher salary in Michigan public schools?',
    strata: S('named-state', 'other', '1'),
    readings: one(R("Michigan's school staffing records", SOC, 'mischooldata_data_socrata_com', 'mischooldata_data_socrata_com_2', 'data_michigan_gov', 'future_michigan_gov')),
  },
  {
    kind: 'single',
    text: 'What crimes were reported in Baton Rouge last month?',
    strata: S('named-city', 'other', '1'),
    readings: one(R("Baton Rouge's crime records", SOC, 'data_brla_gov', 'data_brla_gov_2', 'data_batonrouge')),
  },

  // No data needed.
  {
    kind: 'none',
    text: "What is the difference between a city's operating budget and its capital budget?",
    strata: S('no-place', 'none', '0'),
    readings: [],
    ask: true,
  },
  {
    kind: 'none',
    text: 'Draft a short email to my city council member asking for a new crosswalk.',
    strata: S('no-place', 'none', '0'),
    readings: [],
    ask: true,
  },
  {
    kind: 'none',
    text: 'What does FOIL stand for, and how does a public records request work in general?',
    strata: S('no-place', 'none', '0'),
    readings: [],
    ask: true,
  },

  // An open place.
  {
    kind: 'ambiguous',
    text: 'What is the population of Springfield?',
    strata: S('ambiguous-place', 'census-statistics', '1'),
    readings: one(R('population statistics', DC)),
    ask: true,
    note: 'Springfield fits many places: asking which, or loading Data Commons, which covers them all, is acceptable (rule 10).',
  },
  {
    kind: 'ambiguous',
    text: 'What did the city council vote on last week?',
    strata: S('ambiguous-place', 'legislation-law', '1'),
    readings: one(R("a city council's votes", 'opencity')),
    ask: true,
    note: 'No city is named: asking which, or loading an entry that covers council votes for many cities, is acceptable (rule 10).',
  },
  {
    kind: 'ambiguous',
    text: 'How many police officers does the city employ, and what are they paid?',
    strata: S('ambiguous-place', 'budget-spending', '1'),
    readings: one(R("a city's payroll", SOC)),
    ask: true,
    note: 'No city is named: asking which, or loading an entry that covers payroll for many places, is acceptable (rule 10).',
  },

  // No source in any of the inventories.
  {
    kind: 'single',
    text: 'How many building permits did Boise, Idaho, issue in 2025?',
    strata: S('named-city', 'permits-inspections', '1'),
    readings: one(R("Boise's building permits")),
  },
  {
    kind: 'single',
    text: 'How many 311 calls did Toledo, Ohio, receive last year?',
    strata: S('named-city', '311-service-requests', '1'),
    readings: one(R("Toledo's 311 requests")),
    notes: { 1000: 'arcgis_toledo holds geospatial data, not 311 requests (rule 8).' },
  },
  {
    kind: 'single',
    text: 'How many restaurant inspections were carried out in Phoenix last year?',
    strata: S('named-city', 'permits-inspections', '1'),
    readings: one(R('restaurant inspections in Phoenix')),
    notes: { 1000: 'arcgis_phoenix holds geospatial data, not inspections (rule 8).' },
  },
  {
    kind: 'single',
    text: 'How many eviction cases were filed in Philadelphia last year?',
    strata: S('named-city', 'other', '1'),
    readings: one(R("Philadelphia's eviction filings")),
  },
];

export const QUESTIONS = [...SEED, ...NEW.map((q, i) => ({ id: `q${String(50 + i).padStart(2, '0')}`, ...q }))];
