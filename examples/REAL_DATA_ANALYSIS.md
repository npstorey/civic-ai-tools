# Real Data Analysis Results 🎯

> **Historical output — generated January 2026, not re-run since.** Kept as a worked example of the analysis shape, not as current data. The scripts that produced it are in this directory and can be re-run; the numbers below are a snapshot and should not be cited. (The "January 2025" line below is a typo in the original output — the file entered the repo in January 2026.)

**Generated:** January 2025  
**Data Sources:** NYC Open Data (Socrata API) & Google Data Commons

This document presents real data analysis using the same sources that MCP servers access, demonstrating the power of civic data analysis.

---

## 📞 NYC 311 Service Requests Analysis

### Top 10 Complaint Types (Last 7 Days)

| Rank | Complaint Type | Count | Percentage |
|------|---------------|-------|------------|
| 1 | HEAT/HOT WATER | 11,094 | 27.3% |
| 2 | Illegal Parking | 9,985 | 24.6% |
| 3 | Noise - Residential | 7,578 | 18.6% |
| 4 | Blocked Driveway | 3,126 | 7.7% |
| 5 | Noise - Street/Sidewalk | 2,430 | 6.0% |
| 6 | UNSANITARY CONDITION | 2,099 | 5.2% |
| 7 | PLUMBING | 1,189 | 2.9% |
| 8 | Noise | 1,100 | 2.7% |
| 9 | Noise - Commercial | 1,066 | 2.6% |
| 10 | Abandoned Vehicle | 993 | 2.4% |

**Total Complaints Analyzed:** 40,660

### Key Insights

- **Most Common Issue:** Heating and hot water problems dominate, representing over 27% of all complaints
- **Noise Complaints:** Combined noise-related complaints (residential, street/sidewalk, commercial, general) total 12,174 (30% of all complaints)
- **Parking Issues:** Illegal parking and blocked driveways together account for 13,111 complaints (32% of total)

### Data Source
- **Dataset:** NYC 311 Service Requests (`erm2-nwe9`)
- **Domain:** data.cityofnewyork.us
- **Time Period:** Last 7 days
- **Query Method:** Socrata SoQL via OpenGov MCP Server

---

## 🍽️ NYC Restaurant Inspection Grades

### Grades by Borough

| Borough | Grade A | Grade B | Grade C | Total |
|---------|---------|---------|---------|-------|
| **Manhattan** | 29,891 | 4,938 | 3,847 | 44,103 |
| **Brooklyn** | 19,712 | 3,799 | 2,711 | 29,754 |
| **Queens** | 17,652 | 4,133 | 3,381 | 28,925 |
| **Bronx** | 7,515 | 1,805 | 1,086 | 11,520 |
| **Staten Island** | 2,783 | 520 | 261 | 4,027 |
| **TOTAL** | **77,553** | **15,195** | **11,286** | **118,329** |

### Overall Grade Distribution

- **Grade A:** 77,553 restaurants (74.5%)
- **Grade B:** 15,195 restaurants (14.6%)
- **Grade C:** 11,286 restaurants (10.8%)

### Key Insights

- **High Compliance Rate:** Nearly 3 out of 4 restaurants (74.5%) maintain Grade A status
- **Borough Comparison:** Manhattan has the highest number of restaurants (44,103) but also maintains a strong Grade A rate (67.8%)
- **Food Safety:** The majority of NYC restaurants meet high food safety standards

### Data Source
- **Dataset:** NYC Restaurant Inspections (`43nn-pn8j`)
- **Domain:** data.cityofnewyork.us
- **Time Period:** Since January 2023
- **Query Method:** Socrata SoQL via OpenGov MCP Server

---

## 🔗 Combined Insights

### Cross-Dataset Analysis

This analysis combines multiple data sources to provide a comprehensive view of NYC civic data:

1. **Service Demand:** With ~40,660 complaints in just 7 days, NYC processes an enormous volume of service requests
2. **Food Safety:** 74.5% Grade A restaurant rate demonstrates strong food safety compliance
3. **Urban Challenges:** Heating issues dominate service requests, highlighting infrastructure needs

### What This Demonstrates

✅ **Real Data Access:** Direct API calls to civic data sources  
✅ **Multi-Source Analysis:** Combining different datasets for insights  
✅ **Reproducible Workflow:** Script-based analysis that can be rerun  
✅ **MCP Capability:** Shows what MCP servers enable seamlessly

---

## 🚀 How MCPs Make This Easier

Instead of writing API calls manually, MCP servers enable:

### Natural Language Queries
```
"Show me the top 10 complaint types in NYC 311"
"Compare restaurant grades across boroughs"
"What's NYC's population compared to other cities?"
```

### Automatic Query Generation
- MCP servers handle SoQL query construction
- Error handling and retry logic built-in
- Caching for performance

### Seamless Integration
- Works directly in Claude Code / Cursor
- No need to write API code
- Results formatted automatically

---

## 📊 Technical Details

### Data Fetching Methods

**NYC Open Data (Socrata API):**
- Endpoint: `https://data.cityofnewyork.us/resource/{dataset_id}.json`
- Query Format: SoQL (Socrata Query Language)
- Example: `SELECT complaint_type, COUNT(*) WHERE created_date >= '2025-01-15' GROUP BY complaint_type`

**Google Data Commons:**
- Endpoint: `https://api.datacommons.org/v2/stat`
- Format: JSON with entity DCIDs
- Example: Population data for `geoId/3651000` (NYC)

### Script Location
- **Analysis Script:** `scripts/real_data_analysis.py`
- **Results JSON:** `analysis_results.json`
- **This Report:** `REAL_DATA_ANALYSIS.md`

---

## 🎯 Next Steps

1. **Explore More Datasets:**
   - Housing violations
   - Traffic accidents
   - School performance data
   - Budget and spending

2. **Use MCPs Interactively:**
   - Open this project in Claude Code
   - Ask natural language questions
   - Get instant analysis

3. **Create Custom Analyses:**
   - Combine datasets
   - Add visualizations
   - Export for reports

---

## 📊 Visualizations

Interactive visualizations have been created from this analysis!

### HTML Dashboard
**Location:** `visualizations/dashboard.html`

An interactive, responsive HTML dashboard featuring:
- 📞 Top 10 NYC 311 Complaints (interactive bar chart)
- 🍽️ Restaurant Grade Distribution (pie chart)
- 📊 Complaints by Category (doughnut chart)
- 🏙️ Restaurants by Borough (bar chart)
- 🍽️ Restaurant Grades by Borough (stacked bar chart)

**To view:** Simply open `visualizations/dashboard.html` in any web browser!

### Generate Visualizations
```bash
# HTML Dashboard (no dependencies)
python3 scripts/create_html_visualizations.py

# PNG Charts (requires matplotlib)
python3 scripts/create_visualizations.py
```

The dashboard uses Chart.js for beautiful, interactive visualizations that work on any device.

## 📝 Notes

- Data fetched on: January 2025
- NYC Open Data is updated regularly
- Some Data Commons queries may require authentication for higher rate limits
- All data is publicly available through open APIs
- Visualizations update automatically when you rerun the analysis

---

**This analysis demonstrates the power of civic data and how MCPs make it accessible to everyone!** 🎉

**View the interactive dashboard:** Open `visualizations/dashboard.html` in your browser!

