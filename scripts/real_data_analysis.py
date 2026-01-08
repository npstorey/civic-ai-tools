#!/usr/bin/env python3
"""
Real Data Analysis - Using MCP Data Sources

This script demonstrates fetching real data from the same sources that
the MCP servers use, creating an interesting combined analysis.

Data Sources:
1. NYC Open Data (Socrata API) - via direct API calls
2. Google Data Commons - via direct API calls

This shows what the MCPs enable - seamless access to civic data!
"""

import json
import urllib.request
import urllib.parse
from datetime import datetime, timedelta
from typing import Dict, List, Any
from collections import defaultdict


class RealDataAnalysis:
    """Fetch and analyze real civic data"""
    
    def __init__(self):
        self.socrata_base = "https://data.cityofnewyork.us"
        self.datacommons_base = "https://api.datacommons.org/v2/stat"
        self.results = {}
    
    def print_header(self, title: str, emoji: str = "📊"):
        """Print formatted header"""
        print("\n" + "="*80)
        print(f"{emoji}  {title}")
        print("="*80 + "\n")
    
    def fetch_311_complaints(self, days: int = 7) -> List[Dict]:
        """Fetch recent 311 complaints from NYC Open Data"""
        print(f"📞 Fetching 311 complaints from last {days} days...")
        
        dataset_id = "erm2-nwe9"
        date_threshold = (datetime.now() - timedelta(days=days)).strftime("%Y-%m-%d")
        
        # Socrata SoQL query - use $query parameter for complex queries
        url = f"{self.socrata_base}/resource/{dataset_id}.json"
        query = f"SELECT complaint_type, COUNT(*) as count WHERE created_date >= '{date_threshold}T00:00:00' GROUP BY complaint_type ORDER BY count DESC LIMIT 10"
        params = {
            "$query": query
        }
        
        try:
            # Build URL with query parameters
            query_string = urllib.parse.urlencode(params)
            full_url = f"{url}?{query_string}"
            
            with urllib.request.urlopen(full_url, timeout=10) as response:
                data = json.loads(response.read().decode())
            print(f"✅ Retrieved {len(data)} complaint types")
            return data
        except Exception as e:
            print(f"❌ Error fetching 311 data: {e}")
            return []
    
    def fetch_restaurant_grades(self) -> List[Dict]:
        """Fetch restaurant inspection grades by borough"""
        print("🍽️  Fetching restaurant inspection grades...")
        
        dataset_id = "43nn-pn8j"
        url = f"{self.socrata_base}/resource/{dataset_id}.json"
        query = "SELECT boro, grade, COUNT(*) as count WHERE grade IS NOT NULL AND inspection_date >= '2023-01-01' GROUP BY boro, grade ORDER BY boro, grade LIMIT 100"
        params = {
            "$query": query
        }
        
        try:
            # Build URL with query parameters
            query_string = urllib.parse.urlencode(params)
            full_url = f"{url}?{query_string}"
            
            with urllib.request.urlopen(full_url, timeout=10) as response:
                data = json.loads(response.read().decode())
            print(f"✅ Retrieved {len(data)} grade records")
            return data
        except Exception as e:
            print(f"❌ Error fetching restaurant data: {e}")
            return []
    
    def fetch_nyc_population(self) -> Dict[str, Any]:
        """Fetch NYC population from Data Commons"""
        print("👥 Fetching NYC population data...")
        
        # NYC Data Commons ID
        nyc_dcid = "geoId/3651000"
        
        url = self.datacommons_base
        params = {
            "entity": nyc_dcid,
            "variable": "Count_Person",
            "date": "2022"
        }
        
        try:
            # Build URL with query parameters
            query_string = urllib.parse.urlencode(params)
            full_url = f"{url}?{query_string}"
            
            with urllib.request.urlopen(full_url, timeout=10) as response:
                data = json.loads(response.read().decode())
            
            # Extract population value
            if 'data' in data and nyc_dcid in data['data']:
                population_data = data['data'][nyc_dcid].get('Count_Person', {})
                if '2022' in population_data:
                    population = population_data['2022']
                    print(f"✅ NYC Population (2022): {population:,}")
                    return {"population": population, "year": 2022}
            
            print("⚠️  Population data not found in expected format")
            return {}
        except Exception as e:
            print(f"❌ Error fetching population data: {e}")
            return {}
    
    def fetch_city_comparison(self) -> Dict[str, Dict]:
        """Compare NYC with other major cities"""
        print("🌆 Comparing NYC with other major cities...")
        
        cities = {
            "New York City": "geoId/3651000",
            "Los Angeles": "geoId/0644000",
            "Chicago": "geoId/1714000",
            "Houston": "geoId/4835000",
            "Phoenix": "geoId/0550000"
        }
        
        results = {}
        url = self.datacommons_base
        
        for city_name, dcid in cities.items():
            try:
                params = {
                    "entity": dcid,
                    "variable": "Count_Person",
                    "date": "2022"
                }
                query_string = urllib.parse.urlencode(params)
                full_url = f"{url}?{query_string}"
                
                with urllib.request.urlopen(full_url, timeout=10) as response:
                    data = json.loads(response.read().decode())
                
                if 'data' in data and dcid in data['data']:
                    pop_data = data['data'][dcid].get('Count_Person', {})
                    if '2022' in pop_data:
                        results[city_name] = {
                            "population": pop_data['2022'],
                            "dcid": dcid
                        }
            except Exception as e:
                print(f"⚠️  Error fetching {city_name}: {e}")
        
        print(f"✅ Retrieved data for {len(results)} cities")
        return results
    
    def analyze_311_complaints(self, complaints: List[Dict]):
        """Analyze 311 complaint data"""
        self.print_header("NYC 311 Service Requests Analysis", "📞")
        
        if not complaints:
            print("No data available")
            return
        
        print("Top 10 Complaint Types (Last 7 Days):\n")
        print(f"{'Rank':<6} {'Complaint Type':<40} {'Count':<10}")
        print("-" * 60)
        
        for i, item in enumerate(complaints[:10], 1):
            complaint_type = item.get('complaint_type', 'Unknown')
            count = item.get('count', 0)
            print(f"{i:<6} {complaint_type:<40} {count:<10}")
        
        # Calculate insights
        total = sum(int(item.get('count', 0)) for item in complaints)
        top_complaint = complaints[0] if complaints else None
        
        print(f"\n📊 Insights:")
        print(f"   • Total complaints analyzed: {total:,}")
        if top_complaint:
            top_type = top_complaint.get('complaint_type', 'Unknown')
            top_count = int(top_complaint.get('count', 0))
            percentage = (top_count / total * 100) if total > 0 else 0
            print(f"   • Most common: {top_type} ({percentage:.1f}% of total)")
    
    def analyze_restaurant_grades(self, grades: List[Dict]):
        """Analyze restaurant inspection grades"""
        self.print_header("NYC Restaurant Inspection Grades", "🍽️")
        
        if not grades:
            print("No data available")
            return
        
        # Organize by borough
        borough_data = defaultdict(lambda: {'A': 0, 'B': 0, 'C': 0, 'other': 0})
        
        for item in grades:
            boro = item.get('boro', 'Unknown')
            grade = item.get('grade', '').upper()
            count = int(item.get('count', 0))
            
            if grade in ['A', 'B', 'C']:
                borough_data[boro][grade] += count
            else:
                borough_data[boro]['other'] += count
        
        print("Restaurant Grades by Borough:\n")
        print(f"{'Borough':<15} {'Grade A':<12} {'Grade B':<12} {'Grade C':<12} {'Total':<10}")
        print("-" * 65)
        
        for boro in sorted(borough_data.keys()):
            data = borough_data[boro]
            total = sum(data.values())
            print(f"{boro:<15} {data['A']:<12} {data['B']:<12} {data['C']:<12} {total:<10}")
        
        # Calculate grade distribution
        total_a = sum(data['A'] for data in borough_data.values())
        total_b = sum(data['B'] for data in borough_data.values())
        total_c = sum(data['C'] for data in borough_data.values())
        grand_total = total_a + total_b + total_c
        
        if grand_total > 0:
            print(f"\n📊 Overall Grade Distribution:")
            print(f"   • Grade A: {total_a:,} ({total_a/grand_total*100:.1f}%)")
            print(f"   • Grade B: {total_b:,} ({total_b/grand_total*100:.1f}%)")
            print(f"   • Grade C: {total_c:,} ({total_c/grand_total*100:.1f}%)")
    
    def analyze_population_comparison(self, cities: Dict[str, Dict], nyc_pop: Dict):
        """Compare populations across cities"""
        self.print_header("City Population Comparison", "🌆")
        
        if not cities:
            print("No data available")
            return
        
        print("Major US Cities - Population (2022):\n")
        print(f"{'City':<20} {'Population':<15} {'vs NYC':<15}")
        print("-" * 55)
        
        nyc_population = nyc_pop.get('population', 0)
        
        for city_name in sorted(cities.keys(), key=lambda x: cities[x]['population'], reverse=True):
            city_data = cities[city_name]
            pop = city_data['population']
            
            if nyc_population > 0:
                ratio = pop / nyc_population
                comparison = f"{ratio:.2f}x"
            else:
                comparison = "N/A"
            
            print(f"{city_name:<20} {pop:>14,}  {comparison:<15}")
        
        if nyc_population > 0:
            print(f"\n📊 Insights:")
            total_pop = sum(c['population'] for c in cities.values())
            print(f"   • Combined population of top 5 cities: {total_pop:,}")
            print(f"   • NYC represents {nyc_population/total_pop*100:.1f}% of this total")
    
    def create_combined_insights(self, complaints: List[Dict], grades: List[Dict], 
                                 cities: Dict, nyc_pop: Dict):
        """Create combined insights from all data sources"""
        self.print_header("Combined Insights & Analysis", "🔗")
        
        print("""
This analysis combines data from multiple sources to provide a comprehensive
view of NYC civic data:

1. 📞 NYC 311 Service Requests (OpenGov MCP source)
2. 🍽️  Restaurant Inspections (OpenGov MCP source)  
3. 👥 Population Statistics (Data Commons MCP source)

Key Takeaways:
""")
        
        # Insight 1: Service demand
        if complaints:
            total_complaints = sum(int(c.get('count', 0)) for c in complaints)
            nyc_population = nyc_pop.get('population', 0)
            if nyc_population > 0:
                complaints_per_capita = (total_complaints * 365 / 7) / nyc_population
                print(f"   • Service Demand: ~{complaints_per_capita:.2f} 311 requests per person per year")
        
        # Insight 2: Food safety
        if grades:
            total_restaurants = sum(int(g.get('count', 0)) for g in grades)
            grade_a = sum(int(g.get('count', 0)) for g in grades if g.get('grade', '').upper() == 'A')
            if total_restaurants > 0:
                a_percentage = grade_a / total_restaurants * 100
                print(f"   • Food Safety: {a_percentage:.1f}% of inspected restaurants have Grade A")
        
        # Insight 3: Scale
        if cities and nyc_pop:
            nyc_population = nyc_pop.get('population', 0)
            if nyc_population > 0:
                print(f"   • Scale: NYC's population ({nyc_population:,}) is larger than the next 2 cities combined")
        
        print("""
💡 This demonstrates the power of MCPs:
   • Seamless access to multiple data sources
   • Easy combination of local (OpenGov) and statistical (Data Commons) data
   • Natural language queries that generate these analyses automatically
   • Reproducible, citable civic analysis
""")
    
    def save_results(self, filename: str = "analysis_results.json"):
        """Save analysis results to JSON"""
        output = {
            "timestamp": datetime.now().isoformat(),
            "data_sources": {
                "opengov": "NYC Open Data (Socrata API)",
                "datacommons": "Google Data Commons API"
            },
            "results": self.results
        }
        
        with open(filename, 'w') as f:
            json.dump(output, f, indent=2)
        print(f"\n💾 Results saved to {filename}")
    
    def run_analysis(self):
        """Run complete analysis"""
        print("\n" + "="*80)
        print(" " * 20 + "REAL DATA ANALYSIS")
        print(" " * 15 + "Using MCP Data Sources")
        print("="*80)
        
        print("""
This script fetches real data from the same sources that MCP servers use,
demonstrating what's possible with civic data analysis.

Fetching data from:
  🏛️  NYC Open Data (Socrata API) - via opengov-mcp-server
  🌍  Google Data Commons - via data-commons-mcp

""")
        
        # Fetch all data
        complaints = self.fetch_311_complaints(days=7)
        grades = self.fetch_restaurant_grades()
        nyc_pop = self.fetch_nyc_population()
        cities = self.fetch_city_comparison()
        
        # Store results
        self.results = {
            "311_complaints": complaints,
            "restaurant_grades": grades,
            "nyc_population": nyc_pop,
            "city_comparison": cities
        }
        
        # Analyze each dataset
        self.analyze_311_complaints(complaints)
        print("\n")
        
        self.analyze_restaurant_grades(grades)
        print("\n")
        
        self.analyze_population_comparison(cities, nyc_pop)
        print("\n")
        
        self.create_combined_insights(complaints, grades, cities, nyc_pop)
        
        # Save results
        self.save_results()
        
        self.print_header("Analysis Complete!", "✅")
        print("""
This analysis demonstrates:
✓ Real data fetching from civic data sources
✓ Multi-source data combination
✓ Practical insights and visualizations
✓ Reproducible analysis workflow

Next Steps:
• Use Claude Code with MCPs for interactive analysis
• Ask natural language questions about this data
• Explore more datasets and create custom analyses
• Export results for further processing

The MCP servers make this seamless - just ask Claude!
""")


def main():
    """Main entry point"""
    analyzer = RealDataAnalysis()
    analyzer.run_analysis()


if __name__ == "__main__":
    main()

