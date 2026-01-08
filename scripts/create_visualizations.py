#!/usr/bin/env python3
"""
Create Visualizations from Real Data Analysis

Generates compelling graphs and charts from the civic data analysis.
"""

import json
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib import cm
import numpy as np
from pathlib import Path
from typing import Dict, List


class DataVisualizer:
    """Create visualizations from civic data"""
    
    def __init__(self, results_file: str = "analysis_results.json"):
        """Load analysis results"""
        with open(results_file, 'r') as f:
            self.data = json.load(f)
        
        # Set style
        plt.style.use('seaborn-v0_8-darkgrid')
        self.colors = {
            'primary': '#2E86AB',
            'secondary': '#A23B72',
            'accent': '#F18F01',
            'success': '#06A77D',
            'warning': '#D00000'
        }
    
    def create_311_complaints_chart(self):
        """Create bar chart of top 311 complaints"""
        complaints = self.data['results']['311_complaints']
        
        if not complaints:
            return
        
        # Extract data
        types = [c['complaint_type'] for c in complaints]
        counts = [int(c['count']) for c in complaints]
        
        # Create figure
        fig, ax = plt.subplots(figsize=(12, 8))
        
        # Create horizontal bar chart
        y_pos = np.arange(len(types))
        bars = ax.barh(y_pos, counts, color=self.colors['primary'], alpha=0.8)
        
        # Customize
        ax.set_yticks(y_pos)
        ax.set_yticklabels(types, fontsize=10)
        ax.set_xlabel('Number of Complaints', fontsize=12, fontweight='bold')
        ax.set_title('Top 10 NYC 311 Service Requests\n(Last 7 Days)', 
                     fontsize=16, fontweight='bold', pad=20)
        
        # Add value labels on bars
        for i, (bar, count) in enumerate(zip(bars, counts)):
            width = bar.get_width()
            ax.text(width + 200, bar.get_y() + bar.get_height()/2,
                   f'{count:,}', ha='left', va='center', fontweight='bold')
        
        # Add total
        total = sum(counts)
        ax.text(0.98, 0.02, f'Total: {total:,} complaints',
               transform=ax.transAxes, fontsize=11,
               verticalalignment='bottom', horizontalalignment='right',
               bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
        
        # Invert y-axis to show highest at top
        ax.invert_yaxis()
        ax.grid(axis='x', alpha=0.3)
        
        plt.tight_layout()
        plt.savefig('visualizations/311_complaints_chart.png', dpi=300, bbox_inches='tight')
        print("✅ Created: 311_complaints_chart.png")
        plt.close()
    
    def create_restaurant_grades_chart(self):
        """Create stacked bar chart of restaurant grades by borough"""
        grades = self.data['results']['restaurant_grades']
        
        if not grades:
            return
        
        # Organize data by borough
        boroughs = ['Manhattan', 'Brooklyn', 'Queens', 'Bronx', 'Staten Island']
        grade_counts = {boro: {'A': 0, 'B': 0, 'C': 0} for boro in boroughs}
        
        for item in grades:
            boro = item['boro']
            grade = item['grade'].upper()
            count = int(item['count'])
            if boro in grade_counts and grade in ['A', 'B', 'C']:
                grade_counts[boro][grade] += count
        
        # Prepare data for stacked bar
        a_counts = [grade_counts[b]['A'] for b in boroughs]
        b_counts = [grade_counts[b]['B'] for b in boroughs]
        c_counts = [grade_counts[b]['C'] for b in boroughs]
        
        # Create figure
        fig, ax = plt.subplots(figsize=(12, 8))
        
        x = np.arange(len(boroughs))
        width = 0.6
        
        # Create stacked bars
        bars1 = ax.bar(x, a_counts, width, label='Grade A', 
                      color=self.colors['success'], alpha=0.9)
        bars2 = ax.bar(x, b_counts, width, bottom=a_counts, label='Grade B',
                      color=self.colors['accent'], alpha=0.9)
        bars3 = ax.bar(x, c_counts, width, bottom=np.array(a_counts) + np.array(b_counts),
                      label='Grade C', color=self.colors['warning'], alpha=0.9)
        
        # Customize
        ax.set_xlabel('Borough', fontsize=12, fontweight='bold')
        ax.set_ylabel('Number of Restaurants', fontsize=12, fontweight='bold')
        ax.set_title('NYC Restaurant Inspection Grades by Borough\n(Since January 2023)',
                    fontsize=16, fontweight='bold', pad=20)
        ax.set_xticks(x)
        ax.set_xticklabels(boroughs, fontsize=11)
        ax.legend(loc='upper left', fontsize=11, framealpha=0.9)
        ax.grid(axis='y', alpha=0.3)
        
        # Add value labels
        totals = [a + b + c for a, b, c in zip(a_counts, b_counts, c_counts)]
        for i, total in enumerate(totals):
            ax.text(i, total + 500, f'{total:,}', ha='center', va='bottom',
                   fontweight='bold', fontsize=10)
        
        plt.tight_layout()
        plt.savefig('visualizations/restaurant_grades_chart.png', dpi=300, bbox_inches='tight')
        print("✅ Created: restaurant_grades_chart.png")
        plt.close()
    
    def create_grade_distribution_pie(self):
        """Create pie chart of overall grade distribution"""
        grades = self.data['results']['restaurant_grades']
        
        if not grades:
            return
        
        # Calculate totals
        total_a = sum(int(g['count']) for g in grades if g['grade'].upper() == 'A')
        total_b = sum(int(g['count']) for g in grades if g['grade'].upper() == 'B')
        total_c = sum(int(g['count']) for g in grades if g['grade'].upper() == 'C')
        
        # Create figure
        fig, ax = plt.subplots(figsize=(10, 10))
        
        sizes = [total_a, total_b, total_c]
        labels = ['Grade A', 'Grade B', 'Grade C']
        colors = [self.colors['success'], self.colors['accent'], self.colors['warning']]
        explode = (0.05, 0, 0)  # Explode Grade A slice
        
        # Create pie chart
        wedges, texts, autotexts = ax.pie(sizes, explode=explode, labels=labels, 
                                          colors=colors, autopct='%1.1f%%',
                                          shadow=True, startangle=90,
                                          textprops={'fontsize': 12, 'fontweight': 'bold'})
        
        # Customize percentage text
        for autotext in autotexts:
            autotext.set_color('white')
            autotext.set_fontsize(14)
            autotext.set_fontweight('bold')
        
        ax.set_title('NYC Restaurant Grade Distribution\n(Overall)', 
                    fontsize=16, fontweight='bold', pad=20)
        
        # Add total count
        total = sum(sizes)
        ax.text(0, -1.3, f'Total Restaurants: {total:,}',
               ha='center', fontsize=12, fontweight='bold',
               bbox=dict(boxstyle='round', facecolor='wheat', alpha=0.5))
        
        plt.tight_layout()
        plt.savefig('visualizations/grade_distribution_pie.png', dpi=300, bbox_inches='tight')
        print("✅ Created: grade_distribution_pie.png")
        plt.close()
    
    def create_complaint_categories_chart(self):
        """Create chart grouping complaints into categories"""
        complaints = self.data['results']['311_complaints']
        
        if not complaints:
            return
        
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
        
        # Create figure
        fig, ax = plt.subplots(figsize=(10, 8))
        
        categories_list = list(category_counts.keys())
        counts_list = [category_counts[c] for c in categories_list]
        colors_list = [self.colors['primary'], self.colors['secondary'], 
                      self.colors['accent'], self.colors['warning']]
        
        bars = ax.bar(categories_list, counts_list, color=colors_list, alpha=0.8, edgecolor='black', linewidth=1.5)
        
        # Customize
        ax.set_ylabel('Number of Complaints', fontsize=12, fontweight='bold')
        ax.set_title('NYC 311 Complaints by Category\n(Last 7 Days)',
                    fontsize=16, fontweight='bold', pad=20)
        ax.grid(axis='y', alpha=0.3)
        
        # Add value labels
        for bar, count in zip(bars, counts_list):
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height + 500,
                   f'{count:,}', ha='center', va='bottom', fontweight='bold', fontsize=11)
        
        plt.xticks(fontsize=11, fontweight='bold')
        plt.tight_layout()
        plt.savefig('visualizations/complaint_categories_chart.png', dpi=300, bbox_inches='tight')
        print("✅ Created: complaint_categories_chart.png")
        plt.close()
    
    def create_borough_comparison_chart(self):
        """Create comparison chart showing restaurant density by borough"""
        grades = self.data['results']['restaurant_grades']
        
        if not grades:
            return
        
        # Calculate totals per borough
        borough_totals = {}
        for item in grades:
            boro = item['boro']
            count = int(item['count'])
            if boro not in borough_totals:
                borough_totals[boro] = 0
            borough_totals[boro] += count
        
        # Sort by count
        sorted_boroughs = sorted(borough_totals.items(), key=lambda x: x[1], reverse=True)
        boroughs = [b[0] for b in sorted_boroughs]
        counts = [b[1] for b in sorted_boroughs]
        
        # Create figure
        fig, ax = plt.subplots(figsize=(10, 8))
        
        # Create gradient colors
        colors_gradient = cm.viridis(np.linspace(0.2, 0.8, len(boroughs)))
        
        bars = ax.bar(boroughs, counts, color=colors_gradient, alpha=0.8, edgecolor='black', linewidth=1.5)
        
        # Customize
        ax.set_ylabel('Number of Restaurants', fontsize=12, fontweight='bold')
        ax.set_title('Total Restaurants by Borough\n(NYC Inspection Data)',
                    fontsize=16, fontweight='bold', pad=20)
        ax.grid(axis='y', alpha=0.3)
        
        # Add value labels
        for bar, count in zip(bars, counts):
            height = bar.get_height()
            ax.text(bar.get_x() + bar.get_width()/2., height + 500,
                   f'{count:,}', ha='center', va='bottom', fontweight='bold', fontsize=11)
        
        plt.xticks(fontsize=11, fontweight='bold', rotation=0)
        plt.tight_layout()
        plt.savefig('visualizations/borough_comparison_chart.png', dpi=300, bbox_inches='tight')
        print("✅ Created: borough_comparison_chart.png")
        plt.close()
    
    def create_summary_dashboard(self):
        """Create a multi-panel summary dashboard"""
        fig = plt.figure(figsize=(16, 10))
        gs = fig.add_gridspec(2, 3, hspace=0.3, wspace=0.3)
        
        # Panel 1: Top complaints (top left, spans 2 columns)
        ax1 = fig.add_subplot(gs[0, :2])
        complaints = self.data['results']['311_complaints']
        if complaints:
            types = [c['complaint_type'][:25] + '...' if len(c['complaint_type']) > 25 
                    else c['complaint_type'] for c in complaints[:5]]
            counts = [int(c['count']) for c in complaints[:5]]
            ax1.barh(types, counts, color=self.colors['primary'], alpha=0.8)
            ax1.set_title('Top 5 NYC 311 Complaints', fontweight='bold', fontsize=12)
            ax1.set_xlabel('Complaints', fontsize=10)
            ax1.invert_yaxis()
            for i, count in enumerate(counts):
                ax1.text(count + 200, i, f'{count:,}', va='center', fontweight='bold')
        
        # Panel 2: Grade distribution pie (top right)
        ax2 = fig.add_subplot(gs[0, 2])
        grades = self.data['results']['restaurant_grades']
        if grades:
            total_a = sum(int(g['count']) for g in grades if g['grade'].upper() == 'A')
            total_b = sum(int(g['count']) for g in grades if g['grade'].upper() == 'B')
            total_c = sum(int(g['count']) for g in grades if g['grade'].upper() == 'C')
            ax2.pie([total_a, total_b, total_c], labels=['A', 'B', 'C'],
                   colors=[self.colors['success'], self.colors['accent'], self.colors['warning']],
                   autopct='%1.1f%%', startangle=90)
            ax2.set_title('Restaurant Grades', fontweight='bold', fontsize=12)
        
        # Panel 3: Borough comparison (bottom, spans all)
        ax3 = fig.add_subplot(gs[1, :])
        if grades:
            borough_totals = {}
            for item in grades:
                boro = item['boro']
                count = int(item['count'])
                if boro not in borough_totals:
                    borough_totals[boro] = 0
                borough_totals[boro] += count
            
            sorted_boroughs = sorted(borough_totals.items(), key=lambda x: x[1], reverse=True)
            boroughs = [b[0] for b in sorted_boroughs]
            counts = [b[1] for b in sorted_boroughs]
            
            bars = ax3.bar(boroughs, counts, color=self.colors['secondary'], alpha=0.8)
            ax3.set_title('Restaurants by Borough', fontweight='bold', fontsize=12)
            ax3.set_ylabel('Count', fontsize=10)
            for bar, count in zip(bars, counts):
                height = bar.get_height()
                ax3.text(bar.get_x() + bar.get_width()/2., height + 500,
                        f'{count:,}', ha='center', va='bottom', fontweight='bold', fontsize=9)
        
        fig.suptitle('NYC Civic Data Analysis Dashboard', 
                    fontsize=18, fontweight='bold', y=0.98)
        
        plt.savefig('visualizations/dashboard.png', dpi=300, bbox_inches='tight')
        print("✅ Created: dashboard.png")
        plt.close()
    
    def create_all_visualizations(self):
        """Create all visualizations"""
        # Create output directory
        Path('visualizations').mkdir(exist_ok=True)
        
        print("\n" + "="*60)
        print("Creating Visualizations from Real Data Analysis")
        print("="*60 + "\n")
        
        self.create_311_complaints_chart()
        self.create_restaurant_grades_chart()
        self.create_grade_distribution_pie()
        self.create_complaint_categories_chart()
        self.create_borough_comparison_chart()
        self.create_summary_dashboard()
        
        print("\n" + "="*60)
        print("✅ All visualizations created successfully!")
        print("="*60)
        print("\nVisualizations saved in: visualizations/")
        print("  • 311_complaints_chart.png")
        print("  • restaurant_grades_chart.png")
        print("  • grade_distribution_pie.png")
        print("  • complaint_categories_chart.png")
        print("  • borough_comparison_chart.png")
        print("  • dashboard.png (summary dashboard)")
        print()


def main():
    """Main entry point"""
    try:
        visualizer = DataVisualizer()
        visualizer.create_all_visualizations()
    except FileNotFoundError:
        print("❌ Error: analysis_results.json not found!")
        print("   Please run scripts/real_data_analysis.py first.")
    except Exception as e:
        print(f"❌ Error creating visualizations: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()





