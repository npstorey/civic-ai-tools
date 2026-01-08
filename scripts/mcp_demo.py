#!/usr/bin/env python3
"""
MCP Capabilities Demo - Interactive Showcase

This script demonstrates the powerful capabilities of the MCP servers
configured in this project. It shows real-world use cases for civic data analysis.

MCP Servers Available:
1. OpenGov MCP Server - NYC Open Data (Socrata API)
2. Data Commons MCP - Google Data Commons

Run this script to see examples of what's possible with MCPs!
"""

import json
from datetime import datetime, timedelta
from typing import Dict, List

def print_section(title: str, emoji: str = "📊"):
    """Print a formatted section header"""
    print("\n" + "="*80)
    print(f"{emoji}  {title}")
    print("="*80 + "\n")


def print_code_block(code: str, language: str = "python"):
    """Print formatted code block"""
    print(f"```{language}")
    print(code)
    print("```\n")


def demo_opengov_capabilities():
    """Demonstrate OpenGov MCP Server capabilities"""
    print_section("OpenGov MCP Server - NYC Open Data", "🏛️")
    
    print("""
The OpenGov MCP Server provides seamless access to NYC's Open Data portal
(data.cityofnewyork.us) through the Socrata API. It handles authentication,
query generation, caching, and error handling automatically.

Key Capabilities:
✓ Query NYC datasets using SoQL (Socrata Query Language)
✓ Automatic dataset discovery and metadata retrieval
✓ Built-in caching for performance
✓ Rate limit handling
✓ Error recovery and retry logic
""")
    
    # Example 1: Dataset Discovery
    print("📋 Example 1: Discovering Available Datasets")
    print("-" * 80)
    example_query = """
# Natural Language Request:
"Show me all NYC datasets related to housing"

# MCP Tool Call:
opengov.list_datasets(
    domain="data.cityofnewyork.us",
    search="housing",
    limit=20
)

# Returns: List of dataset metadata including:
# - Dataset ID
# - Title and description
# - Column names and types
# - Last updated date
# - Row count
"""
    print_code_block(example_query.strip(), "python")
    
    # Example 2: Querying 311 Data
    print("📞 Example 2: Analyzing 311 Service Requests")
    print("-" * 80)
    one_week_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    example_query = f"""
# Natural Language Request:
"What are the top 10 complaint types in NYC 311 from the last week?"

# MCP Tool Call:
opengov.query_dataset(
    domain="data.cityofnewyork.us",
    dataset_id="erm2-nwe9",
    query='''
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
    '''
)

# Returns: JSON array with complaint types and counts
# [
#   {{"complaint_type": "Noise - Street/Sidewalk", "count": 1234}},
#   {{"complaint_type": "Illegal Parking", "count": 987}},
#   ...
# ]
"""
    print_code_block(example_query.strip(), "python")
    
    # Example 3: Restaurant Inspections
    print("🍽️ Example 3: Restaurant Inspection Analysis")
    print("-" * 80)
    example_query = """
# Natural Language Request:
"Show me restaurant inspection grades by borough"

# MCP Tool Call:
opengov.query_dataset(
    domain="data.cityofnewyork.us",
    dataset_id="43nn-pn8j",
    query='''
        SELECT 
            boro,
            grade,
            COUNT(*) as count
        WHERE 
            grade IS NOT NULL
        GROUP BY 
            boro, grade
        ORDER BY 
            boro, grade
    '''
)

# Returns: Breakdown of restaurant grades by borough
"""
    print_code_block(example_query.strip(), "python")
    
    # Example 4: Time Series Analysis
    print("📈 Example 4: Time Series Trend Analysis")
    print("-" * 80)
    example_query = """
# Natural Language Request:
"Show me housing violation trends over the past year"

# MCP Tool Call:
opengov.query_dataset(
    domain="data.cityofnewyork.us",
    dataset_id="wvxf-dwi5",
    query='''
        SELECT 
            DATE_TRUNC_MONTH(inspectiondate) as month,
            COUNT(*) as violation_count
        WHERE 
            inspectiondate >= '2023-01-01'
        GROUP BY 
            month
        ORDER BY 
            month
    '''
)

# Returns: Monthly violation counts for trend analysis
"""
    print_code_block(example_query.strip(), "python")


def demo_datacommons_capabilities():
    """Demonstrate Data Commons MCP capabilities"""
    print_section("Data Commons MCP - Google Data Commons", "🌍")
    
    print("""
The Data Commons MCP provides access to Google's Data Commons, a massive
repository of statistical data from governments, research institutions, and
organizations worldwide. It enables cross-jurisdictional comparisons and
comprehensive demographic/economic analysis.

Key Capabilities:
✓ Search for geographic entities (cities, states, countries)
✓ Retrieve statistical data across multiple variables
✓ Compare data across different locations
✓ Access census, economic, and demographic data
✓ Time series data retrieval
""")
    
    # Example 1: Entity Search
    print("🔍 Example 1: Finding Geographic Entities")
    print("-" * 80)
    example_query = """
# Natural Language Request:
"Find New York City in Data Commons"

# MCP Tool Call:
data_commons.search_entities(
    query="New York City",
    entity_type="City",
    limit=5
)

# Returns: List of matching entities with DCIDs (Data Commons IDs)
# [
#   {
#     "dcid": "geoId/3651000",
#     "name": "New York City",
#     "type": "City"
#   },
#   ...
# ]
"""
    print_code_block(example_query.strip(), "python")
    
    # Example 2: Population Data
    print("👥 Example 2: Retrieving Population Statistics")
    print("-" * 80)
    example_query = """
# Natural Language Request:
"What's the population of New York City?"

# MCP Tool Call:
data_commons.get_statistics(
    entity_dcids=["geoId/3651000"],
    variables=["Count_Person"],
    date="2022"
)

# Returns: Population data for NYC
# {
#   "geoId/3651000": {
#     "Count_Person": {
#       "2022": 8336817
#     }
#   }
# }
"""
    print_code_block(example_query.strip(), "python")
    
    # Example 3: Comparative Analysis
    print("📊 Example 3: Comparing Cities")
    print("-" * 80)
    example_query = """
# Natural Language Request:
"Compare median income in NYC, LA, and Chicago"

# MCP Tool Call:
data_commons.get_statistics(
    entity_dcids=[
        "geoId/3651000",  # NYC
        "geoId/0644000",  # LA
        "geoId/1714000"   # Chicago
    ],
    variables=["Median_Income_Person"],
    date="2022"
)

# Returns: Comparative income data across all three cities
"""
    print_code_block(example_query.strip(), "python")
    
    # Example 4: Time Series
    print("📈 Example 4: Historical Trends")
    print("-" * 80)
    example_query = """
# Natural Language Request:
"Show me NYC population growth over the past 20 years"

# MCP Tool Call:
data_commons.get_statistics(
    entity_dcids=["geoId/3651000"],
    variables=["Count_Person"],
    date_range=["2000", "2023"]
)

# Returns: Year-by-year population data
"""
    print_code_block(example_query.strip(), "python")


def demo_combined_analysis():
    """Show how to combine both MCPs for powerful analysis"""
    print_section("Combined Analysis - Using Both MCPs Together", "🚀")
    
    print("""
The real power of MCPs shines when you combine multiple data sources!
Here's an example of a comprehensive civic analysis using both MCPs.
""")
    
    example_workflow = """
# Analysis Goal: "Analyze NYC housing violations in context of demographic changes"

# Step 1: Get demographic context from Data Commons
demographics = data_commons.get_statistics(
    entity_dcids=["geoId/3651000"],
    variables=[
        "Count_Person",
        "Median_Income_Person",
        "Count_HousingUnit"
    ],
    date="2022"
)

# Step 2: Get housing violation data from OpenGov
violations = opengov.query_dataset(
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
census_data = data_commons.get_statistics(
    entity_dcids=["geoId/3651000"],
    variables=["Count_Person"],
    date="2022"
)

# Step 4: Combine insights
# - Compare violation rates per capita
# - Analyze correlation with income levels
# - Identify neighborhoods needing intervention
"""
    print_code_block(example_workflow.strip(), "python")
    
    print("""
Benefits of Combined Analysis:
✓ Context: Local data (OpenGov) + broader context (Data Commons)
✓ Validation: Cross-check data from multiple sources
✓ Completeness: Fill gaps in one dataset with another
✓ Insights: Discover patterns not visible in single-source analysis
""")


def demo_interactive_usage():
    """Show how to use MCPs interactively with Claude"""
    print_section("Interactive Usage with Claude", "💬")
    
    print("""
When using Claude Code / Cursor with MCPs configured, you can ask natural
language questions and Claude will automatically use the appropriate MCP tools!

Example Conversations:
""")
    
    examples = [
        {
            "question": "What are the most common 311 complaints in Manhattan?",
            "explanation": "Claude uses OpenGov MCP to query NYC 311 dataset, filters by borough, groups by complaint type, and presents results."
        },
        {
            "question": "Compare NYC's population density with other major US cities",
            "explanation": "Claude uses Data Commons MCP to find cities, retrieve population and area data, calculates density, and creates a comparison table."
        },
        {
            "question": "Show me restaurant inspection trends in Brooklyn over the past year",
            "explanation": "Claude uses OpenGov MCP to query restaurant inspection dataset, filters by borough and date range, groups by month, and visualizes trends."
        },
        {
            "question": "What's the relationship between median income and housing violations in NYC?",
            "explanation": "Claude combines both MCPs: gets income data from Data Commons, violation data from OpenGov, correlates them, and provides analysis."
        },
        {
            "question": "Find all datasets related to transportation in NYC",
            "explanation": "Claude uses OpenGov MCP to search datasets, filters by keywords, and presents a curated list with descriptions."
        }
    ]
    
    for i, example in enumerate(examples, 1):
        print(f"\n{i}. Question: \"{example['question']}\"")
        print(f"   → {example['explanation']}")


def demo_advanced_features():
    """Showcase advanced MCP features"""
    print_section("Advanced Features & Best Practices", "⚡")
    
    print("""
1. Caching & Performance
   - OpenGov MCP has built-in caching (CACHE_ENABLED=true)
   - Reduces API calls and improves response times
   - Automatic cache invalidation on dataset updates

2. Error Handling
   - Automatic retry on transient failures
   - Rate limit detection and backoff
   - Clear error messages with suggestions

3. Query Optimization
   - OpenGov MCP Companion Skill provides query patterns
   - Best practices for SoQL queries
   - Performance tips for large datasets

4. Data Export
   - Results can be exported to CSV, JSON, or Python DataFrames
   - Reproducible analysis scripts
   - Version control friendly outputs

5. Skills Integration
   - OpenGov MCP Companion Skill guides Claude
   - Provides domain-specific knowledge
   - Suggests relevant datasets and queries
""")


def main():
    """Run the complete MCP demo"""
    print("\n" + "="*80)
    print(" " * 20 + "MCP CAPABILITIES DEMO")
    print(" " * 15 + "Showcasing Civic AI Tools")
    print("="*80)
    
    print("""
This demo showcases the powerful capabilities of Model Context Protocol (MCP)
servers configured in this project. MCPs enable seamless access to civic data
through natural language interactions with Claude.

Available MCP Servers:
  🏛️  OpenGov MCP Server    → NYC Open Data (Socrata API)
  🌍  Data Commons MCP       → Google Data Commons

Press Enter to continue through each section...
""")
    
    demo_opengov_capabilities()
    input("\n[Press Enter to continue to Data Commons demo...]")
    
    demo_datacommons_capabilities()
    input("\n[Press Enter to continue to combined analysis...]")
    
    demo_combined_analysis()
    input("\n[Press Enter to continue to interactive usage...]")
    
    demo_interactive_usage()
    input("\n[Press Enter to continue to advanced features...]")
    
    demo_advanced_features()
    
    print_section("Demo Complete!", "✅")
    print("""
Next Steps:
1. Open this project in Cursor / Claude Code
2. Ask Claude natural language questions about NYC data
3. Watch as Claude automatically uses MCP tools to answer!
4. Explore the scripts/ directory for more examples

Try these questions:
  • "What are the top 10 complaint types in NYC 311?"
  • "Show me restaurant inspection grades by borough"
  • "Compare NYC's population with other major cities"
  • "Analyze housing violation trends over time"

Happy analyzing! 🎉
""")


if __name__ == "__main__":
    main()

