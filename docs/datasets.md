# Curated Dataset Directory

High-value civic datasets across major Socrata open data portals. This is a hand-curated "greatest hits" list — use the MCP server's `search` tool for datasets not listed here.

Last verified: 2026-03-08
License: CC0 1.0 — this directory (the curation, descriptions, and field notes) is dedicated to the public domain; see [LICENSING.md](../LICENSING.md). The datasets it points to are governed by their source portals' terms.

---

## NYC Open Data (`data.cityofnewyork.us`)

### Public Safety

| Dataset | 4x4 ID | Key Fields | Volume | Frequency |
|---------|--------|------------|--------|-----------|
| 311 Service Requests (2020+) | `erm2-nwe9` | complaint_type, borough, created_date, closed_date, status, descriptor | ~10k/day | Daily |
| Motor Vehicle Collisions - Crashes | `h9gi-nx95` | crash_date, crash_time, borough, on_street_name, number_of_persons_injured, contributing_factor_vehicle_1 | ~600/day | Daily |
| NYPD Arrest Data (YTD) | `uip8-fykc` | arrest_date, arrest_boro, ofns_desc, perp_race, age_group, latitude, longitude | ~250/day | Quarterly |

### Housing & Development

| Dataset | 4x4 ID | Key Fields | Volume | Frequency |
|---------|--------|------------|--------|-----------|
| Housing Violations | `wvxf-dwi5` | boro, violationid, inspectiondate, class, novdescription | ~500-1k/day | Daily |
| DOB Job Application Filings | `ic3t-wcy2` | job_type, borough, job_status, building_type, initial_cost, pre__filing_date | ~200/day | Daily |
| DOB Permit Issuance | `ipu4-2q9a` | issuance_date, permit_type, job_type, work_type, permit_status, bin__ | ~300/day | Daily |

### Health

| Dataset | 4x4 ID | Key Fields | Volume | Frequency |
|---------|--------|------------|--------|-----------|
| Restaurant Inspections (DOHMH) | `43nn-pn8j` | dba, inspection_date, grade, violation_code, score, cuisine_description, boro | ~27k total grades | Daily |
| NYC Leading Causes of Death | `jb7j-dtam` | leading_cause, race_ethnicity, year, deaths, sex | ~1.1k rows | Annually |

### City Government & Budget

| Dataset | 4x4 ID | Key Fields | Volume | Frequency |
|---------|--------|------------|--------|-----------|
| Budget Data | `d52a-yn36` | agency_name, budget_amount, fiscal_year | ~4k/year | Annually |
| Citywide Payroll Data | `k397-673e` | agency_name, title_description, base_salary, regular_gross_paid, fiscal_year | ~500k/year | Annually |
| Civil Service List (Active) | `vx8i-nprf` | exam_no, list_title_desc, first_name, last_name, published_date | ~80k rows | Daily |
| OATH Hearings Case Status | `jz4z-kudi` | ticket_number, violation_date, hearing_date, penalty_imposed, case_disposition | ~5M rows | Daily |

### Transportation

| Dataset | 4x4 ID | Key Fields | Volume | Frequency |
|---------|--------|------------|--------|-----------|
| Open Parking and Camera Violations | `nc67-uf89` | summons_number, plate, violation, issue_date, amount_due | ~10M rows | Daily |
| For Hire Vehicles (FHV) - Active | `8wbx-tsch` | vehicle_license_number, base_name, license_type, expiration_date | ~100k rows | Daily |
| Film Permits | `tg4x-b46p` | eventid, eventtype, startdatetime, enddatetime, borough, category | ~5k/year | Daily |

---

## Chicago (`data.cityofchicago.org`)

### Public Safety

| Dataset | 4x4 ID | Key Fields | Volume | Frequency |
|---------|--------|------------|--------|-----------|
| Crimes - 2001 to Present | `ijzp-q8t2` | date, primary_type, description, location_description, arrest, domestic, ward, beat, latitude, longitude | ~5k/day | Daily |
| Crimes - One Year Prior | `x2n5-8w5q` | date_of_occurrence, primary_description, block, ward, arrest, domestic | Rolling 1yr | Daily |
| Arrests | `dpt3-jri9` | arrest_date, charge_1_description, case_number, race, district | ~200/day | Daily |
| IUCR Codes (reference) | `c7ck-438e` | iucr, primary_description, secondary_description, index_code | ~400 rows | As needed |

### Transportation

| Dataset | 4x4 ID | Key Fields | Volume | Frequency |
|---------|--------|------------|--------|-----------|
| Traffic Crashes - Crashes | `85ca-t3if` | crash_date, crash_type, injuries_total, damage, street_no, street_direction, weather_condition | ~300/day | Daily |
| Taxi Trips (2013-2023) | `wrvz-psew` | trip_start_timestamp, trip_miles, trip_seconds, fare, company, payment_type | ~200M rows | Historical |
| Towed Vehicles | `ygr5-vcbg` | plate, make, model, tow_date, towed_to_address, color | Rolling 90 days | Hourly |

### Permits & Housing

| Dataset | 4x4 ID | Key Fields | Volume | Frequency |
|---------|--------|------------|--------|-----------|
| Building Permits | `ydr8-5enu` | permit_type, issue_date, estimated_cost, work_description, contractor_name | ~200/day | Daily |
| Building Violations | `22u3-xenr` | violation_code, violation_description, inspection_number, address, violation_date | ~500/day | Daily |
| Ordinance Violations (Buildings) | `awqx-tuwv` | violation_date, violation_description, imposed_fine, case_disposition, address | ~200/day | Daily |
| Affordable Rental Housing | `s6ha-ppgi` | property_type, address, zip_code, units, management_company | ~600 rows | Periodically |
| City-Owned Land Inventory | `aksk-kvfp` | address, zoning, land_value, property_status, pin | ~11k rows | Daily |

### Health & Inspections

| Dataset | 4x4 ID | Key Fields | Volume | Frequency |
|---------|--------|------------|--------|-----------|
| Food Inspections | `4ijn-s7e5` | dba_name, inspection_date, inspection_type, results, risk, violations, facility_type | ~200k rows | Daily |

### Business & Economy

| Dataset | 4x4 ID | Key Fields | Volume | Frequency |
|---------|--------|------------|--------|-----------|
| Business Licenses - Current Active | `uupf-x98q` | license_number, business_activity, date_issued, expiration_date, address, ward | ~60k rows | Daily |
| Business Licenses (all) | `r5kz-chrr` | account_number, legal_name, license_status, business_activity, address | ~700k rows | Daily |
| Business Owners | `ezma-pppn` | owner_first_name, owner_last_name, account_number, doing_business_as_name | ~700k rows | Daily |

### City Government

| Dataset | 4x4 ID | Key Fields | Volume | Frequency |
|---------|--------|------------|--------|-----------|
| Employee Names, Salaries, Positions | `xzkq-xp2w` | name, job_titles, department, annual_salary, hourly_rate, full_or_part_time | ~33k rows | Daily |
| Contracts | `rsxa-ify5` | vendor_name, department, award_amount, contract_type, start_date, approval_date | ~150k rows | Daily |
| Census Socioeconomic Indicators | `kn9c-c2s2` | community_area_name, poverty, unemployment, income, hardship_index | 77 rows | As available |

---

## San Francisco (`data.sfgov.org`)

### Public Safety

| Dataset | 4x4 ID | Key Fields | Volume | Frequency |
|---------|--------|------------|--------|-----------|
| Police Incident Reports (2018+) | `wg3w-h783` | incident_date, incident_category, incident_code, police_district, latitude, longitude | ~400/day | Daily |
| Police Incident Reports (2003-2018) | `tmnf-yvry` | date, time, category, descript, address, pddistrict | ~2.2M rows | Historical |
| Law Enforcement Dispatched Calls (real-time) | `gnap-fj3t` | received_datetime, call_type_original, call_type_final, priority_original, disposition | ~1k/day | Sub-hourly |
| Fire Incidents | `wr8u-xric` | alarm_dttm, arrival_dttm, primary_situation, address, zipcode, call_number | ~50k/year | Daily |
| Fire/EMS Dispatched Calls | `nuek-vuh3` | call_date, call_type, unit_id, dispatch_dttm, on_scene_dttm, station_area | ~300k/year | Daily |
| Traffic Crashes Resulting in Injury | `ubvf-ztfx` | collision_date, number_killed, number_injured, collision_severity | ~3k/year | Quarterly |

### City Services

| Dataset | 4x4 ID | Key Fields | Volume | Frequency |
|---------|--------|------------|--------|-----------|
| 311 Cases | `vw6y-z8j6` | requested_datetime, service_name, status_description, agency_responsible, neighborhood | ~2k/day | Daily |
| Street Sweeping Schedule | `yhqp-riqs` | corridor, weekday, fromhour, tohour, blocksweepid | ~30k rows | As needed |

### Housing & Buildings

| Dataset | 4x4 ID | Key Fields | Volume | Frequency |
|---------|--------|------------|--------|-----------|
| Building Permits | `i98e-djp9` | permit_number, filed_date, issued_date, description, proposed_use, estimated_cost | ~200/day | Daily |
| Eviction Notices | `5cei-gny5` | file_date, address, non_payment, owner_move_in, ellis_act_withdrawal | ~200/month | Daily |
| Assessor Property Tax Rolls | `wv5m-vpq2` | parcel_number, assessed_land_value, assessed_improvement_value, property_class_code | ~200k rows | Annually |

### Business & Economy

| Dataset | 4x4 ID | Key Fields | Volume | Frequency |
|---------|--------|------------|--------|-----------|
| Registered Business Locations | `g8m3-pdis` | dba_name, full_business_address, certificate_number, location | ~200k rows | Daily |
| Active Business Locations | `kvj8-g7jh` | dba_name, ownership_name, naic_code, supervisor_district, location | ~90k rows | Daily |
| Mobile Food Facility Permits | `rqzj-sfat` | applicant, address, facilitytype, fooditems, status, expirationdate | ~500 rows | Daily |

### Transportation

| Dataset | 4x4 ID | Key Fields | Volume | Frequency |
|---------|--------|------------|--------|-----------|
| Air Traffic Passenger Statistics | `rkru-6vcg` | operating_airline, passenger_count, activity_period, geo_region, terminal | ~30k rows | Quarterly |
| Parking Meters | `8vzz-qzz9` | parking_space_id, street_name, cap_color, meter_type, active_meter_flag | ~37k rows | Weekly |

### City Government

| Dataset | 4x4 ID | Key Fields | Volume | Frequency |
|---------|--------|------------|--------|-----------|
| Employee Compensation | `88g8-5mnd` | department, salaries, overtime, retirement, total_compensation, union, year | ~250k rows | Weekly |

### Health

| Dataset | 4x4 ID | Key Fields | Volume | Frequency |
|---------|--------|------------|--------|-----------|
| Health Inspection Scores (2016-2019) | `pyih-qa8i` | business_name, inspection_score, violation_description, risk_category | ~30k rows | Historical |

---

## Seattle (`data.seattle.gov`)

### Public Safety

| Dataset | 4x4 ID | Key Fields | Volume | Frequency |
|---------|--------|------------|--------|-----------|
| SPD Crime Data (2008+) | `tazs-3rd5` | offense_category, offense_date, neighborhood, beat, latitude, longitude | ~1.5k/day | Daily |
| Real Time Fire 911 Calls | `kzjm-xkqj` | type, datetime, longitude, latitude, incident_number, address | ~150/day | Real-time |
| Police Call Data | `33kz-ixgy` | initial_call_type, cad_event_original_time_queued, dispatch_address, dispatch_beat, final_call_type | ~500/day | Daily |
| SPD Arrest Data | `9bjs-7a7w` | cad_initial_call_type, subject_race, force_involved, officer_gender, crisis_involved | ~50/day | Daily |
| Use of Force | `ppi5-g2bj` | incident_type, incident_num, subject_gender, subject_race, officer_id, occured_date_time | ~2k/year | Daily |
| Terry Stops | `28ny-9ts8` | call_type, officer_gender, subject__perceived_gender, frisk_flag, arrest_flag, weapon_type | ~3k/year | Daily |

### Permits & Housing

| Dataset | 4x4 ID | Key Fields | Volume | Frequency |
|---------|--------|------------|--------|-----------|
| Building Permits | `76t5-zqzr` | permitnum, statuscurrent, permitclass, location1, issueddate | ~200/day | Daily |
| Land Use Permits | `q2zt-n6jk` | permitnum, statuscurrent, permitclass, location1, issueddate | ~50/day | Daily |
| Code Complaints and Violations | `ez4a-iug7` | recordnum, statuscurrent, opendate, lastinspdate, recordtype | ~30/day | Daily |
| Rental Property Registration | `j2xh-c7vt` | registereddate, statuscurrent, location1_address, rentalhousingunits | ~20k rows | Daily |
| Unreinforced Masonry Buildings | `54qs-2h7f` | address, year_built, no_stories, preliminary_risk_category, neighborhood | ~1.1k rows | Periodically |

### Business

| Dataset | 4x4 ID | Key Fields | Volume | Frequency |
|---------|--------|------------|--------|-----------|
| Active Business License Tax Certificates | `wnbq-64tb` | business_legal_name, trade_name, naics_code, street_address, city_account_number | ~50k rows | Daily |

### City Government

| Dataset | 4x4 ID | Key Fields | Volume | Frequency |
|---------|--------|------------|--------|-----------|
| City Wage Data | `2khk-5ukd` | hourly_rate, job_title, department, first_name, last_name | ~14k rows | Monthly |
| Staff Demographics | `5avq-r9hj` | age, deptname, sex, reg_temp, empl_status, hourly_rt | ~14k rows | Monthly |

### Transportation

| Dataset | 4x4 ID | Key Fields | Volume | Frequency |
|---------|--------|------------|--------|-----------|
| Fremont Bridge Bicycle Counter | `65db-xm6k` | date, fremont_bridge_nb, fremont_bridge_sb | ~250k rows | Monthly |
| Road Weather Information Stations | `egc4-d24i` | stationname, datetime, roadsurfacetemperature, airtemperature | ~5M rows | Hourly |

### Culture & Community

| Dataset | 4x4 ID | Key Fields | Volume | Frequency |
|---------|--------|------------|--------|-----------|
| Library Checkouts by Title | `tmmm-ytt6` | title, creator, checkoutyear, checkoutmonth, checkouts, materialtype | ~40M rows | Monthly |
| Seattle Pet Licenses | `jguv-t9rb` | animal_s_name, species, primary_breed, zip_code, license_issue_date | ~60k rows | Quarterly |

---

## Los Angeles (`data.lacity.org`)

**Note:** Only `get_data` works reliably for LA. Use web search to find dataset IDs, then query with `get_data` exclusively.

### Public Safety

| Dataset | 4x4 ID | Key Fields | Volume | Frequency |
|---------|--------|------------|--------|-----------|
| Crime Data (2020-2024) | `2nrs-mtv8` | date_occ, dr_no, area, crm_cd, location, lat, lon, weapon_desc, vict_descent | ~250/day | Historical |
| Crime Data (2010-2019) | `63jg-8b9z` | date_occ, dr_no, area, crm_cd, location, lat, lon, weapon_desc, vict_age | ~2M rows | Historical |
| Arrest Data (2010-2019) | `yru6-6re4` | arst_date, charge, grp_description, area, lat, lon, sex_cd | ~1.3M rows | Historical |
| Traffic Collision Data (2010+) | `d5tf-ez2w` | dr_no, date_occ, area, location_1, lat, lon, vict_age, premis_desc | ~600k rows | Historical |

### City Services

| Dataset | 4x4 ID | Key Fields | Volume | Frequency |
|---------|--------|------------|--------|-----------|
| MyLA311 2025 | `h73f-gn57` | created_date, request_type, status, address, latitude, longitude | ~4k/day | Daily |
| MyLA311 2022 | `i5ke-k6by` | created_date, request_type, status, address | ~1.4M rows | Historical |
| MyLA311 2020 | `rq3b-xjk8` | created_date, request_type, status, address | ~1.4M rows | Historical |
| Street Sweeping Routes | `krk7-ayq2` | route_no, cd, time_start, time_end, boundaries | ~1k rows | Static |

### Business & Economy

| Dataset | 4x4 ID | Key Fields | Volume | Frequency |
|---------|--------|------------|--------|-----------|
| Listing of Active Businesses | `6rrh-rzua` | business_name, street_address, naics, dba_name, council_district, zip_code | ~600k rows | Monthly |

### Permits & Development

| Dataset | 4x4 ID | Key Fields | Volume | Frequency |
|---------|--------|------------|--------|-----------|
| Building Permits: New Housing Units | `cpkv-aajs` | pcis_permit, issue_date, street_name, zip_code, valuation, of_residential_dwelling_units | ~30k rows | Periodically |
| Certificate of Occupancy | `3f9m-afei` | cofo_number, status, issue_date, occupancy, zone | ~30k rows | Weekly |

### Environment

| Dataset | 4x4 ID | Key Fields | Volume | Frequency |
|---------|--------|------------|--------|-----------|
| Energy & Water Efficiency (EBEWE) | `9yda-i4ya` | building_address, energy_star_score, site_eui, water_use, compliance_status | ~20k rows | Weekly |

### City Infrastructure

| Dataset | 4x4 ID | Key Fields | Volume | Frequency |
|---------|--------|------------|--------|-----------|
| Addresses in the City of LA | `4ca8-mxuh` | hse_nbr, str_nm, zip_cd, lat, lon, cncl_dist | ~900k rows | Daily |

---

## Usage Notes

- **This list supplements live catalog search.** Always use the MCP's `search` tool for datasets not listed here.
- **4x4 IDs are stable** but datasets can be retired. If a query returns 404, search for the replacement.
- **Volume estimates are approximate** and based on recent observation. Check actual row counts with `SELECT COUNT(*)`.
- **For LA datasets**, only `get_data` works — search and fetch tools fail. Use known 4x4 IDs from this directory.
- **For SF datasets**, search sometimes returns NYC results. Use known 4x4 IDs or web search to find SF-specific datasets.
