#!/usr/bin/env python3
"""
Create HTML Visualizations from Real Data Analysis

Generates an interactive HTML dashboard with charts using Chart.js (CDN).
No additional Python dependencies required!
"""

import json
from pathlib import Path
from datetime import datetime


class HTMLVisualizer:
    """Create HTML visualizations from civic data"""
    
    def __init__(self, results_file: str = "analysis_results.json"):
        """Load analysis results"""
        with open(results_file, 'r') as f:
            self.data = json.load(f)
    
    def create_html_dashboard(self):
        """Create interactive HTML dashboard"""
        
        # Extract data
        complaints = self.data['results']['311_complaints']
        grades = self.data['results']['restaurant_grades']
        
        # Prepare complaint data
        complaint_types = [c['complaint_type'] for c in complaints]
        complaint_counts = [int(c['count']) for c in complaints]
        total_complaints = sum(complaint_counts)
        
        # Prepare restaurant grade data by borough
        boroughs = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island']
        grade_data = {boro: {'A': 0, 'B': 0, 'C': 0} for boro in boroughs}
        
        for item in grades:
            boro = item['boro']
            grade = item['grade'].upper()
            count = int(item['count'])
            if boro in grade_data and grade in ['A', 'B', 'C']:
                grade_data[boro][grade] += count
        
        # Calculate totals
        total_a = sum(grade_data[b]['A'] for b in boroughs)
        total_b = sum(grade_data[b]['B'] for b in boroughs)
        total_c = sum(grade_data[b]['C'] for b in boroughs)
        total_restaurants = total_a + total_b + total_c
        
        # Borough totals
        borough_totals = [sum(grade_data[b].values()) for b in boroughs]
        
        # Categorize complaints
        categories = {
            'Infrastructure': ['HEAT/HOT WATER', 'PLUMBING'],
            'Noise': ['Noise - Residential', 'Noise - Street/Sidewalk', 
                     'Noise - Commercial', 'Noise'],
            'Parking': ['Illegal Parking', 'Blocked Driveway'],
            'Other': []
        }
        
        category_counts = {cat: 0 for cat in categories.keys()}
        for complaint in complaints:
            complaint_type = complaint['complaint_type']
            count = int(complaint['count'])
            categorized = False
            for category, types in categories.items():
                if complaint_type in types:
                    category_counts[category] += count
                    categorized = True
                    break
            if not categorized:
                category_counts['Other'] += count
        
        # Generate HTML
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NYC Civic Data Analysis Dashboard</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <style>
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            min-height: 100vh;
        }}
        
        .container {{
            max-width: 1400px;
            margin: 0 auto;
        }}
        
        .header {{
            background: white;
            padding: 30px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            margin-bottom: 30px;
            text-align: center;
        }}
        
        .header h1 {{
            color: #2c3e50;
            font-size: 2.5em;
            margin-bottom: 10px;
        }}
        
        .header p {{
            color: #7f8c8d;
            font-size: 1.1em;
        }}
        
        .grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(500px, 1fr));
            gap: 30px;
            margin-bottom: 30px;
        }}
        
        .card {{
            background: white;
            padding: 25px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }}
        
        .card h2 {{
            color: #2c3e50;
            margin-bottom: 20px;
            font-size: 1.5em;
            border-bottom: 3px solid #667eea;
            padding-bottom: 10px;
        }}
        
        .chart-container {{
            position: relative;
            height: 400px;
            margin-top: 20px;
        }}
        
        .stats {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-top: 20px;
        }}
        
        .stat-box {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            border-radius: 10px;
            text-align: center;
        }}
        
        .stat-box h3 {{
            font-size: 2em;
            margin-bottom: 5px;
        }}
        
        .stat-box p {{
            font-size: 0.9em;
            opacity: 0.9;
        }}
        
        .full-width {{
            grid-column: 1 / -1;
        }}
        
        .footer {{
            background: white;
            padding: 20px;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
            text-align: center;
            color: #7f8c8d;
        }}
        
        @media (max-width: 768px) {{
            .grid {{
                grid-template-columns: 1fr;
            }}
        }}
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🏛️ NYC Civic Data Analysis Dashboard</h1>
            <p>Real-time insights from NYC Open Data & Google Data Commons</p>
            <p style="margin-top: 10px; font-size: 0.9em;">Generated: {datetime.now().strftime('%B %d, %Y at %I:%M %p')}</p>
        </div>
        
        <div class="stats">
            <div class="stat-box">
                <h3>{total_complaints:,}</h3>
                <p>311 Complaints (7 days)</p>
            </div>
            <div class="stat-box">
                <h3>{total_restaurants:,}</h3>
                <p>Restaurants Inspected</p>
            </div>
            <div class="stat-box">
                <h3>{(total_a/total_restaurants*100):.1f}%</h3>
                <p>Grade A Restaurants</p>
            </div>
            <div class="stat-box">
                <h3>{len(complaints)}</h3>
                <p>Complaint Types</p>
            </div>
        </div>
        
        <div class="grid">
            <div class="card">
                <h2>📞 Top 10 NYC 311 Complaints</h2>
                <div class="chart-container">
                    <canvas id="complaintsChart"></canvas>
                </div>
            </div>
            
            <div class="card">
                <h2>🍽️ Restaurant Grade Distribution</h2>
                <div class="chart-container">
                    <canvas id="gradePieChart"></canvas>
                </div>
            </div>
            
            <div class="card">
                <h2>📊 Complaints by Category</h2>
                <div class="chart-container">
                    <canvas id="categoryChart"></canvas>
                </div>
            </div>
            
            <div class="card">
                <h2>🏙️ Restaurants by Borough</h2>
                <div class="chart-container">
                    <canvas id="boroughChart"></canvas>
                </div>
            </div>
            
            <div class="card full-width">
                <h2>🍽️ Restaurant Grades by Borough</h2>
                <div class="chart-container" style="height: 500px;">
                    <canvas id="gradeStackedChart"></canvas>
                </div>
            </div>
        </div>
        
        <div class="footer">
            <p>Data Sources: NYC Open Data (Socrata API) | Generated using MCP Data Sources</p>
            <p style="margin-top: 10px; font-size: 0.9em;">This dashboard demonstrates the power of civic data analysis using MCP servers</p>
        </div>
    </div>
    
    <script>
        // Chart.js configuration
        Chart.defaults.font.family = "'Segoe UI', Roboto, sans-serif";
        Chart.defaults.font.size = 12;
        
        // Color palette
        const colors = {{
            primary: '#667eea',
            secondary: '#764ba2',
            accent: '#f093fb',
            success: '#4facfe',
            warning: '#fa709a',
            info: '#30cfd0'
        }};
        
        // 1. Top 311 Complaints - Horizontal Bar Chart
        const complaintsCtx = document.getElementById('complaintsChart').getContext('2d');
        new Chart(complaintsCtx, {{
            type: 'bar',
            data: {{
                labels: {json.dumps(complaint_types)},
                datasets: [{{
                    label: 'Complaints',
                    data: {json.dumps(complaint_counts)},
                    backgroundColor: 'rgba(102, 126, 234, 0.8)',
                    borderColor: 'rgba(102, 126, 234, 1)',
                    borderWidth: 2
                }}]
            }},
            options: {{
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {{
                    legend: {{ display: false }},
                    tooltip: {{
                        callbacks: {{
                            label: function(context) {{
                                return context.parsed.x.toLocaleString() + ' complaints';
                            }}
                        }}
                    }}
                }},
                scales: {{
                    x: {{
                        beginAtZero: true,
                        ticks: {{
                            callback: function(value) {{
                                return value.toLocaleString();
                            }}
                        }}
                    }}
                }}
            }}
        }});
        
        // 2. Grade Distribution Pie Chart
        const gradePieCtx = document.getElementById('gradePieChart').getContext('2d');
        new Chart(gradePieCtx, {{
            type: 'pie',
            data: {{
                labels: ['Grade A', 'Grade B', 'Grade C'],
                datasets: [{{
                    data: [{total_a}, {total_b}, {total_c}],
                    backgroundColor: [
                        'rgba(79, 172, 254, 0.8)',
                        'rgba(250, 112, 154, 0.8)',
                        'rgba(255, 99, 132, 0.8)'
                    ],
                    borderColor: [
                        'rgba(79, 172, 254, 1)',
                        'rgba(250, 112, 154, 1)',
                        'rgba(255, 99, 132, 1)'
                    ],
                    borderWidth: 2
                }}]
            }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {{
                    legend: {{
                        position: 'bottom'
                    }},
                    tooltip: {{
                        callbacks: {{
                            label: function(context) {{
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return label + ': ' + value.toLocaleString() + ' (' + percentage + '%)';
                            }}
                        }}
                    }}
                }}
            }}
        }});
        
        // 3. Complaints by Category
        const categoryCtx = document.getElementById('categoryChart').getContext('2d');
        new Chart(categoryCtx, {{
            type: 'doughnut',
            data: {{
                labels: {json.dumps(list(category_counts.keys()))},
                datasets: [{{
                    data: {json.dumps(list(category_counts.values()))},
                    backgroundColor: [
                        'rgba(102, 126, 234, 0.8)',
                        'rgba(118, 75, 162, 0.8)',
                        'rgba(240, 147, 251, 0.8)',
                        'rgba(48, 207, 208, 0.8)'
                    ],
                    borderColor: [
                        'rgba(102, 126, 234, 1)',
                        'rgba(118, 75, 162, 1)',
                        'rgba(240, 147, 251, 1)',
                        'rgba(48, 207, 208, 1)'
                    ],
                    borderWidth: 2
                }}]
            }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {{
                    legend: {{
                        position: 'bottom'
                    }},
                    tooltip: {{
                        callbacks: {{
                            label: function(context) {{
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return label + ': ' + value.toLocaleString() + ' (' + percentage + '%)';
                            }}
                        }}
                    }}
                }}
            }}
        }});
        
        // 4. Restaurants by Borough
        const boroughCtx = document.getElementById('boroughChart').getContext('2d');
        new Chart(boroughCtx, {{
            type: 'bar',
            data: {{
                labels: {json.dumps(boroughs)},
                datasets: [{{
                    label: 'Restaurants',
                    data: {json.dumps(borough_totals)},
                    backgroundColor: 'rgba(118, 75, 162, 0.8)',
                    borderColor: 'rgba(118, 75, 162, 1)',
                    borderWidth: 2
                }}]
            }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {{
                    legend: {{ display: false }},
                    tooltip: {{
                        callbacks: {{
                            label: function(context) {{
                                return context.parsed.y.toLocaleString() + ' restaurants';
                            }}
                        }}
                    }}
                }},
                scales: {{
                    y: {{
                        beginAtZero: true,
                        ticks: {{
                            callback: function(value) {{
                                return value.toLocaleString();
                            }}
                        }}
                    }}
                }}
            }}
        }});
        
        // 5. Restaurant Grades by Borough - Stacked Bar Chart
        const gradeStackedCtx = document.getElementById('gradeStackedChart').getContext('2d');
        new Chart(gradeStackedCtx, {{
            type: 'bar',
            data: {{
                labels: {json.dumps(boroughs)},
                datasets: [
                    {{
                        label: 'Grade A',
                        data: {json.dumps([grade_data[b]['A'] for b in boroughs])},
                        backgroundColor: 'rgba(79, 172, 254, 0.8)',
                        borderColor: 'rgba(79, 172, 254, 1)',
                        borderWidth: 2
                    }},
                    {{
                        label: 'Grade B',
                        data: {json.dumps([grade_data[b]['B'] for b in boroughs])},
                        backgroundColor: 'rgba(250, 112, 154, 0.8)',
                        borderColor: 'rgba(250, 112, 154, 1)',
                        borderWidth: 2
                    }},
                    {{
                        label: 'Grade C',
                        data: {json.dumps([grade_data[b]['C'] for b in boroughs])},
                        backgroundColor: 'rgba(255, 99, 132, 0.8)',
                        borderColor: 'rgba(255, 99, 132, 1)',
                        borderWidth: 2
                    }}
                ]
            }},
            options: {{
                responsive: true,
                maintainAspectRatio: false,
                scales: {{
                    x: {{
                        stacked: true
                    }},
                    y: {{
                        stacked: true,
                        beginAtZero: true,
                        ticks: {{
                            callback: function(value) {{
                                return value.toLocaleString();
                            }}
                        }}
                    }}
                }},
                plugins: {{
                    legend: {{
                        position: 'top'
                    }},
                    tooltip: {{
                        callbacks: {{
                            label: function(context) {{
                                return context.dataset.label + ': ' + context.parsed.y.toLocaleString();
                            }}
                        }}
                    }}
                }}
            }}
        }});
    </script>
</body>
</html>"""
        
        # Save HTML file
        output_path = Path('visualizations/dashboard.html')
        output_path.parent.mkdir(exist_ok=True)
        
        with open(output_path, 'w') as f:
            f.write(html)
        
        print(f"✅ Created: {output_path}")
        print(f"   Open in browser: file://{output_path.absolute()}")
        return output_path


def main():
    """Main entry point"""
    try:
        visualizer = HTMLVisualizer()
        visualizer.create_html_dashboard()
        print("\n" + "="*60)
        print("✅ HTML Dashboard created successfully!")
        print("="*60)
        print("\nOpen visualizations/dashboard.html in your browser to view!")
    except FileNotFoundError:
        print("❌ Error: analysis_results.json not found!")
        print("   Please run scripts/real_data_analysis.py first.")
    except Exception as e:
        print(f"❌ Error creating visualizations: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()





