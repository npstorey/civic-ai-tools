# Data Visualizations 📊

This directory contains visualizations generated from the real data analysis.

## 📁 Files

### `dashboard.html` ⭐ **RECOMMENDED**
Interactive HTML dashboard with multiple charts:
- Top 10 NYC 311 Complaints (horizontal bar chart)
- Restaurant Grade Distribution (pie chart)
- Complaints by Category (doughnut chart)
- Restaurants by Borough (bar chart)
- Restaurant Grades by Borough (stacked bar chart)

**To view:** Simply open `dashboard.html` in any web browser. No additional software needed!

### Generated Charts (if matplotlib is available)
If you run `scripts/create_visualizations.py` with matplotlib installed, you'll get:
- `311_complaints_chart.png` - Top complaints bar chart
- `restaurant_grades_chart.png` - Grades by borough stacked chart
- `grade_distribution_pie.png` - Overall grade distribution
- `complaint_categories_chart.png` - Complaints by category
- `borough_comparison_chart.png` - Borough comparison
- `dashboard.png` - Summary dashboard

## 🚀 How to Generate

### HTML Dashboard (No Dependencies)
```bash
python3 scripts/create_html_visualizations.py
```

### PNG Charts (Requires matplotlib)
```bash
pip install matplotlib
python3 scripts/create_visualizations.py
```

## 📊 Data Sources

All visualizations are based on real data from:
- **NYC Open Data** (Socrata API) - 311 complaints and restaurant inspections
- **Google Data Commons** - Population and demographic data

Data is fetched via the same APIs that MCP servers use, demonstrating the power of civic data analysis.

## 🎨 Features

The HTML dashboard includes:
- ✅ Interactive charts (hover for details)
- ✅ Responsive design (works on mobile/tablet/desktop)
- ✅ Beautiful gradient design
- ✅ Real-time statistics
- ✅ No external dependencies (uses CDN for Chart.js)

## 📝 Notes

- Visualizations are generated from `analysis_results.json`
- Run `scripts/real_data_analysis.py` first to fetch fresh data
- Charts update automatically when data changes

---

**Created with ❤️ using MCP data sources**





