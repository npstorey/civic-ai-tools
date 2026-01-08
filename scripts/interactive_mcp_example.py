#!/usr/bin/env python3
"""
Interactive MCP Example - Real-World Usage Patterns

This script demonstrates practical examples of how to use MCPs for civic analysis.
It shows the structure of queries and expected outputs, even if MCPs aren't
directly callable from Python (they work through Claude Code).

Run this to see example workflows and copy patterns for your own analysis!
"""

import json
from datetime import datetime, timedelta
from typing import Dict, List, Any


class MCPExample:
    """Example MCP usage patterns"""
    
    def __init__(self):
        self.opengov_examples = []
        self.datacommons_examples = []
        self.combined_examples = []
    
    def print_header(self, title: str, emoji: str = "📊"):
        """Print formatted header"""
        print("\n" + "="*80)
        print(f"{emoji}  {title}")
        print("="*80 + "\n")
    
    def example_1_311_top_complaints(self):
        """Example: Top 311 complaints"""
        self.print_header("Example 1: Top 311 Complaints by Type", "📞")
        
        print("""
Use Case: Identify the most common service requests in NYC

Natural Language Query:
  "What are the top 10 complaint types in NYC 311 from the last week?"

MCP Tool: opengov.query_dataset

Parameters:
  - domain: "data.cityofnewyork.us"
  - dataset_id: "erm2-nwe9" (NYC 311 Service Requests)
  - query: SoQL query string

SoQL Query:
""")
        
        one_week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
        query = f"""
SELECT 
  complaint_type,
  COUNT(*) as count
WHERE 
  created_date >= '{one_week_ago}T00:00:00'
GROUP BY 
  complaint_type
ORDER BY 
  count DESC
LIMIT 10
""".strip()
        
        print(query)
        print("\nExpected Output Format:")
        print(json.dumps([
            {"complaint_type": "Noise - Street/Sidewalk", "count": 1234},
            {"complaint_type": "Illegal Parking", "count": 987},
            {"complaint_type": "Blocked Driveway", "count": 856}
        ], indent=2))
        
        print("\n💡 Use Case: City planning, resource allocation, trend analysis")
    
    def example_2_restaurant_grades(self):
        """Example: Restaurant inspection grades by borough"""
        self.print_header("Example 2: Restaurant Grades by Borough", "🍽️")
        
        print("""
Use Case: Analyze food safety compliance across NYC boroughs

Natural Language Query:
  "Show me restaurant inspection grades by borough"

MCP Tool: opengov.query_dataset

SoQL Query:
""")
        
        query = """
SELECT 
  boro,
  grade,
  COUNT(*) as count,
  ROUND(AVG(score), 2) as avg_score
WHERE 
  grade IS NOT NULL
  AND inspection_date >= '2023-01-01'
GROUP BY 
  boro, grade
ORDER BY 
  boro, grade
""".strip()
        
        print(query)
        print("\nExpected Output Format:")
        print(json.dumps([
            {
                "boro": "MANHATTAN",
                "grade": "A",
                "count": 5432,
                "avg_score": 12.5
            },
            {
                "boro": "MANHATTAN",
                "grade": "B",
                "count": 234,
                "avg_score": 28.3
            }
        ], indent=2))
        
        print("\n💡 Use Case: Public health monitoring, consumer awareness, policy evaluation")
    
    def example_3_housing_violations_trends(self):
        """Example: Housing violation trends over time"""
        self.print_header("Example 3: Housing Violation Trends", "🏠")
        
        print("""
Use Case: Track housing code compliance over time

Natural Language Query:
  "Show me housing violation trends by month for the past year"

MCP Tool: opengov.query_dataset

SoQL Query:
""")
        
        one_year_ago = (datetime.now() - timedelta(days=365)).strftime("%Y-%m-%d")
        query = f"""
SELECT 
  DATE_TRUNC_MONTH(inspectiondate) as month,
  COUNT(*) as violation_count,
  COUNT(DISTINCT buildingid) as affected_buildings
WHERE 
  inspectiondate >= '{one_year_ago}'
GROUP BY 
  month
ORDER BY 
  month
""".strip()
        
        print(query)
        print("\nExpected Output Format:")
        print(json.dumps([
            {"month": "2023-01-01T00:00:00", "violation_count": 1234, "affected_buildings": 567},
            {"month": "2023-02-01T00:00:00", "violation_count": 1345, "affected_buildings": 589}
        ], indent=2))
        
        print("\n💡 Use Case: Trend analysis, policy impact assessment, resource planning")
    
    def example_4_population_comparison(self):
        """Example: Compare populations across cities"""
        self.print_header("Example 4: Population Comparison", "👥")
        
        print("""
Use Case: Compare NYC demographics with other major cities

Natural Language Query:
  "Compare NYC's population with Los Angeles and Chicago"

MCP Tool: data_commons.get_statistics

Step 1: Find entity DCIDs
""")
        
        print("""
# Search for entities
nyc = data_commons.search_entities("New York City", entity_type="City")
la = data_commons.search_entities("Los Angeles", entity_type="City")
chicago = data_commons.search_entities("Chicago", entity_type="City")

# Extract DCIDs
nyc_dcid = nyc[0].dcid  # "geoId/3651000"
la_dcid = la[0].dcid    # "geoId/0644000"
chicago_dcid = chicago[0].dcid  # "geoId/1714000"
""")
        
        print("\nStep 2: Get population statistics")
        print("""
populations = data_commons.get_statistics(
    entity_dcids=["geoId/3651000", "geoId/0644000", "geoId/1714000"],
    variables=["Count_Person"],
    date="2022"
)
""")
        
        print("\nExpected Output Format:")
        print(json.dumps({
            "geoId/3651000": {
                "Count_Person": {"2022": 8336817}
            },
            "geoId/0644000": {
                "Count_Person": {"2022": 3898747}
            },
            "geoId/1714000": {
                "Count_Person": {"2022": 2693976}
            }
        }, indent=2))
        
        print("\n💡 Use Case: Urban planning, policy benchmarking, demographic research")
    
    def example_5_income_analysis(self):
        """Example: Income analysis with Data Commons"""
        self.print_header("Example 5: Income Analysis", "💰")
        
        print("""
Use Case: Analyze income distribution and trends

Natural Language Query:
  "Show me median income trends in NYC over the past 10 years"

MCP Tool: data_commons.get_statistics

MCP Call:
""")
        
        print("""
income_trends = data_commons.get_statistics(
    entity_dcids=["geoId/3651000"],
    variables=["Median_Income_Person"],
    date_range=["2013", "2023"]
)
""")
        
        print("\nExpected Output Format:")
        print(json.dumps({
            "geoId/3651000": {
                "Median_Income_Person": {
                    "2013": 52323,
                    "2014": 53456,
                    "2015": 54890,
                    # ... more years
                    "2023": 67234
                }
            }
        }, indent=2))
        
        print("\n💡 Use Case: Economic analysis, policy evaluation, inequality research")
    
    def example_6_combined_analysis(self):
        """Example: Combined OpenGov + Data Commons analysis"""
        self.print_header("Example 6: Combined Analysis", "🔗")
        
        print("""
Use Case: Correlate local policy data with demographic context

Natural Language Query:
  "What's the relationship between median income and housing violations in NYC?"

Workflow:
""")
        
        print("""
# Step 1: Get income data from Data Commons
income_data = data_commons.get_statistics(
    entity_dcids=["geoId/3651000"],
    variables=["Median_Income_Person"],
    date="2022"
)

# Step 2: Get violation data from OpenGov
violation_data = opengov.query_dataset(
    domain="data.cityofnewyork.us",
    dataset_id="wvxf-dwi5",
    query='''
        SELECT 
            boro,
            COUNT(*) as violation_count,
            AVG(CAST(approveddate - inspectiondate AS INTEGER)) as avg_days_to_resolve
        WHERE 
            inspectiondate >= '2022-01-01'
        GROUP BY 
            boro
    '''
)

# Step 3: Cross-reference with census tract data
census_tracts = data_commons.get_statistics(
    entity_dcids=["geoId/3651000"],
    variables=["Count_Person", "Median_Income_Person"],
    date="2022"
)

# Step 4: Claude combines and analyzes
# - Correlates violation rates with income levels
# - Identifies neighborhoods needing intervention
# - Provides policy recommendations
""")
        
        print("\n💡 Use Case: Policy research, social equity analysis, resource allocation")
    
    def example_7_dataset_discovery(self):
        """Example: Discovering available datasets"""
        self.print_header("Example 7: Dataset Discovery", "🔍")
        
        print("""
Use Case: Find relevant datasets for your research

Natural Language Query:
  "Find all NYC datasets related to transportation"

MCP Tool: opengov.list_datasets

MCP Call:
""")
        
        print("""
datasets = opengov.list_datasets(
    domain="data.cityofnewyork.us",
    search="transportation",
    limit=20
)
""")
        
        print("\nExpected Output Format:")
        print(json.dumps([
            {
                "id": "h9gi-nx95",
                "name": "Motor Vehicle Collisions - Crashes",
                "description": "Records of motor vehicle collisions in NYC",
                "category": "Transportation",
                "row_count": 2000000,
                "columns": ["crash_date", "borough", "contributing_factor", ...],
                "updated_at": "2024-01-15T10:30:00Z"
            },
            {
                "id": "fhrw-4uyv",
                "name": "Subway Entrances",
                "description": "Locations of subway entrances",
                "category": "Transportation",
                "row_count": 5000,
                "columns": ["station_name", "line", "entrance_type", ...],
                "updated_at": "2024-01-10T08:15:00Z"
            }
        ], indent=2))
        
        print("\n💡 Use Case: Research planning, data exploration, finding relevant sources")
    
    def run_all_examples(self):
        """Run all examples"""
        print("\n" + "="*80)
        print(" " * 25 + "INTERACTIVE MCP EXAMPLES")
        print(" " * 20 + "Real-World Usage Patterns")
        print("="*80)
        
        print("""
This script demonstrates practical examples of using MCPs for civic analysis.
These patterns show how Claude Code uses MCP tools to answer your questions.

Note: MCPs work through Claude Code, not directly from Python.
This script shows the structure and expected outputs.
""")
        
        self.example_1_311_top_complaints()
        input("\n[Press Enter for next example...]")
        
        self.example_2_restaurant_grades()
        input("\n[Press Enter for next example...]")
        
        self.example_3_housing_violations_trends()
        input("\n[Press Enter for next example...]")
        
        self.example_4_population_comparison()
        input("\n[Press Enter for next example...]")
        
        self.example_5_income_analysis()
        input("\n[Press Enter for next example...]")
        
        self.example_6_combined_analysis()
        input("\n[Press Enter for next example...]")
        
        self.example_7_dataset_discovery()
        
        self.print_header("Examples Complete!", "✅")
        print("""
Next Steps:
1. Open this project in Claude Code / Cursor
2. Ask Claude questions using these patterns
3. Watch Claude automatically use MCP tools
4. Adapt these examples for your own analysis

Try asking:
  • "What are the top 10 complaint types in NYC 311?"
  • "Show me restaurant inspection grades by borough"
  • "Compare NYC's population with other major cities"
  • "Find datasets related to [your topic]"

Happy analyzing! 🎉
""")


def main():
    """Main entry point"""
    demo = MCPExample()
    demo.run_all_examples()


if __name__ == "__main__":
    main()

