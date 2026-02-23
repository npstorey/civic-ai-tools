"""
NYC 311 Service Requests Dashboard - December 2025
Designed following Edward Tufte's principles of information design:
- Maximize data-ink ratio
- Eliminate chartjunk
- Use small multiples for comparison
- Direct labeling over legends
- Sparklines for temporal context
"""

import streamlit as st
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import pandas as pd
import numpy as np

# =============================================================================
# Page Configuration
# =============================================================================
st.set_page_config(
    page_title="NYC 311 Dashboard - Dec 2025",
    page_icon="📊",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# Tufte-inspired minimal styling
st.markdown("""
<style>
    /* Remove Streamlit padding and maximize space */
    .block-container {padding: 1rem 2rem;}

    /* Typography - clean, readable */
    h1 {font-size: 1.8rem !important; font-weight: 400 !important; color: #333;}
    h2 {font-size: 1.3rem !important; font-weight: 400 !important; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 0.3rem;}
    h3 {font-size: 1.1rem !important; font-weight: 400 !important; color: #666;}

    /* Metric styling - minimal */
    [data-testid="stMetricValue"] {font-size: 2rem !important; font-weight: 300 !important;}
    [data-testid="stMetricLabel"] {font-size: 0.85rem !important; color: #666 !important;}

    /* Hide hamburger menu */
    #MainMenu {visibility: hidden;}
    footer {visibility: hidden;}
</style>
""", unsafe_allow_html=True)

# =============================================================================
# Data - Embedded from NYC Open Data queries (December 2025)
# =============================================================================

# Daily volume data
daily_data = pd.DataFrame({
    'date': pd.date_range('2025-12-01', '2025-12-31'),
    'count': [12304, 12226, 12507, 13116, 13129, 11185, 10629, 12547, 14078, 12181,
              11675, 12034, 10474, 11274, 16388, 13946, 10499, 9555, 10170, 8484,
              8013, 10007, 8354, 7780, 6216, 8510, 7838, 8698, 9452, 10072, 8761]
})
daily_data['day_of_week'] = daily_data['date'].dt.day_name()
daily_data['week'] = daily_data['date'].dt.isocalendar().week

# Complaint types with resolution rates
complaint_data = pd.DataFrame({
    'complaint_type': ['Heat/Hot Water', 'Noise - Residential', 'Illegal Parking',
                       'Blocked Driveway', 'Unsanitary Condition', 'Snow or Ice',
                       'Plumbing', 'Paint/Plaster', 'Street Condition', 'Noise - Street',
                       'Door/Window', 'Abandoned Vehicle', 'Water System', 'Traffic Signal',
                       'Noise - Commercial'],
    'count': [63902, 57386, 44161, 16409, 9692, 8700, 6841, 5183, 4830, 4787,
              4707, 4576, 4202, 4152, 3964],
    'closed': [63843, 57386, 44161, 16409, 5664, 8693, 4636, 3704, 4568, 4787,
               2887, 4576, 3873, 4148, 3964]
})
complaint_data['resolution_rate'] = (complaint_data['closed'] / complaint_data['count'] * 100).round(1)
complaint_data['open'] = complaint_data['count'] - complaint_data['closed']

# Agency data
agency_data = pd.DataFrame({
    'agency': ['NYPD', 'HPD', 'DSNY', 'DOT', 'DEP', 'DOB', 'DPR', 'DOHMH', 'TLC', 'DHS'],
    'name': ['Police', 'Housing', 'Sanitation', 'Transportation', 'Environmental',
             'Buildings', 'Parks', 'Health', 'Taxi/Limo', 'Homeless Services'],
    'count': [142720, 105826, 27485, 16414, 12611, 7870, 5206, 5156, 3087, 2290],
    'closed': [142720, 90340, 26633, 15014, 11939, 7870, 3440, 2648, 1007, 2263],
    'median_hours': [0.97, 54.90, 47.02, 45.21, 25.57, 27.22, 44.28, 12.70, 35.96, 20.77]
})
agency_data['resolution_rate'] = (agency_data['closed'] / agency_data['count'] * 100).round(1)

# Borough data
borough_data = pd.DataFrame({
    'borough': ['Bronx', 'Brooklyn', 'Queens', 'Manhattan', 'Staten Island'],
    'count': [96322, 93503, 69534, 61500, 11009],
    'closed': [90309, 86062, 64649, 53473, 10314],
    'median_hours': [22.38, 2.90, 3.28, 3.95, 22.77]
})
borough_data['resolution_rate'] = (borough_data['closed'] / borough_data['count'] * 100).round(1)

# Borough x Top Complaint cross-tab
borough_complaint = pd.DataFrame({
    'borough': ['Bronx', 'Bronx', 'Brooklyn', 'Brooklyn', 'Manhattan', 'Queens', 'Queens'],
    'complaint': ['Noise-Residential', 'Heat/Hot Water', 'Illegal Parking', 'Heat/Hot Water',
                  'Heat/Hot Water', 'Illegal Parking', 'Heat/Hot Water'],
    'count': [37472, 22787, 17623, 16866, 15586, 13828, 8141]
})

# Channel data
channel_data = pd.DataFrame({
    'channel': ['Online', 'Mobile', 'Phone', 'Unknown'],
    'count': [152801, 88719, 69946, 20636]
})

# =============================================================================
# Tufte-Style Chart Configurations
# =============================================================================

# Minimal color palette - data-focused
COLORS = {
    'primary': '#2c3e50',      # Dark blue-gray for main data
    'secondary': '#7f8c8d',    # Gray for secondary
    'accent': '#c0392b',       # Red for highlights/alerts
    'success': '#27ae60',      # Green for positive
    'light': '#ecf0f1',        # Light background
    'text': '#333333'
}

def tufte_layout(fig, title=None, height=300):
    """Apply Tufte-style minimal layout to plotly figure"""
    fig.update_layout(
        title=dict(text=title, font=dict(size=14, color=COLORS['text']), x=0) if title else None,
        paper_bgcolor='white',
        plot_bgcolor='white',
        font=dict(family='Georgia, serif', size=11, color=COLORS['text']),
        margin=dict(l=40, r=20, t=40 if title else 20, b=40),
        height=height,
        showlegend=False,
        hovermode='x unified'
    )
    # Minimal axes - Tufte advocates removing non-data ink
    fig.update_xaxes(
        showgrid=False,
        showline=True,
        linewidth=1,
        linecolor='#ddd',
        tickfont=dict(size=10)
    )
    fig.update_yaxes(
        showgrid=True,
        gridwidth=1,
        gridcolor='#f5f5f5',
        showline=False,
        tickfont=dict(size=10)
    )
    return fig

def create_sparkline(values, height=40, color=COLORS['primary']):
    """Create a minimal Tufte sparkline"""
    fig = go.Figure()
    fig.add_trace(go.Scatter(
        y=values,
        mode='lines',
        line=dict(color=color, width=1.5),
        fill=None,
        hoverinfo='skip'
    ))
    # Add min/max markers (Tufte's "intense points")
    min_idx, max_idx = values.argmin(), values.argmax()
    fig.add_trace(go.Scatter(
        x=[min_idx, max_idx],
        y=[values.min(), values.max()],
        mode='markers+text',
        marker=dict(size=6, color=[COLORS['accent'], COLORS['success']]),
        text=[f'{values.min():,.0f}', f'{values.max():,.0f}'],
        textposition=['bottom center', 'top center'],
        textfont=dict(size=9),
        hoverinfo='skip'
    ))
    fig.update_layout(
        paper_bgcolor='white',
        plot_bgcolor='white',
        margin=dict(l=5, r=5, t=5, b=5),
        height=height,
        showlegend=False,
        xaxis=dict(visible=False),
        yaxis=dict(visible=False)
    )
    return fig

# =============================================================================
# Dashboard Layout
# =============================================================================

st.title("NYC 311 Service Requests")
st.markdown("**December 2025** · 332,102 requests · Data from NYC Open Data")

# -----------------------------------------------------------------------------
# Row 1: Key Metrics with Sparklines
# -----------------------------------------------------------------------------
st.markdown("---")

col1, col2, col3, col4, col5 = st.columns(5)

with col1:
    st.metric("Total Requests", "332,102", delta=None)
    st.caption("10,713 daily avg")

with col2:
    st.metric("Resolution Rate", "90.7%", delta=None)
    st.caption("301,350 closed")

with col3:
    st.metric("Median Response", "3.5 hrs", delta=None)
    st.caption("Varies by agency")

with col4:
    st.metric("Peak Day", "Dec 15", delta="+53%")
    st.caption("16,388 requests")

with col5:
    st.metric("Low Day", "Dec 25", delta="-42%")
    st.caption("6,216 requests")

# Daily trend sparkline
st.markdown("##### Daily Volume Trend")
st.plotly_chart(
    create_sparkline(daily_data['count'].values, height=60),
    use_container_width=True,
    config={'displayModeBar': False}
)

# -----------------------------------------------------------------------------
# Row 2: Main Visualizations - Small Multiples
# -----------------------------------------------------------------------------
st.markdown("---")
st.markdown("## Complaint Analysis")

col_left, col_right = st.columns([2, 1])

with col_left:
    # Horizontal bar chart - Top complaints with resolution rates
    # Direct labeling instead of legend (Tufte principle)
    fig_complaints = go.Figure()

    # Sort by count
    df = complaint_data.head(12).sort_values('count')

    # Closed portion
    fig_complaints.add_trace(go.Bar(
        y=df['complaint_type'],
        x=df['closed'],
        orientation='h',
        marker_color=COLORS['primary'],
        text=[f"{v:,.0f}" for v in df['closed']],
        textposition='inside',
        textfont=dict(color='white', size=10),
        hovertemplate='%{y}<br>Closed: %{x:,.0f}<extra></extra>'
    ))

    # Open portion (stacked)
    fig_complaints.add_trace(go.Bar(
        y=df['complaint_type'],
        x=df['open'],
        orientation='h',
        marker_color=COLORS['accent'],
        text=[f"{v:,.0f}" if v > 500 else "" for v in df['open']],
        textposition='inside',
        textfont=dict(color='white', size=10),
        hovertemplate='%{y}<br>Open: %{x:,.0f}<extra></extra>'
    ))

    # Add resolution rate annotations (direct labeling)
    for i, row in df.iterrows():
        fig_complaints.add_annotation(
            x=row['count'] + 1000,
            y=row['complaint_type'],
            text=f"{row['resolution_rate']:.0f}%",
            showarrow=False,
            font=dict(size=10, color=COLORS['success'] if row['resolution_rate'] >= 95 else COLORS['accent']),
            xanchor='left'
        )

    fig_complaints.update_layout(
        barmode='stack',
        xaxis_title='Requests',
        yaxis_title=None
    )
    tufte_layout(fig_complaints, "Top 12 Complaint Types (with resolution %)", height=400)
    st.plotly_chart(fig_complaints, use_container_width=True, config={'displayModeBar': False})

with col_right:
    st.markdown("##### Submission Channels")
    # Minimal pie alternative - stacked single bar
    total = channel_data['count'].sum()
    channel_data['pct'] = channel_data['count'] / total * 100

    fig_channel = go.Figure()
    colors = [COLORS['primary'], '#5d6d7e', '#85929e', COLORS['light']]
    cumsum = 0
    for i, row in channel_data.iterrows():
        fig_channel.add_trace(go.Bar(
            x=[row['pct']],
            y=[''],
            orientation='h',
            marker_color=colors[i],
            text=f"{row['channel']}<br>{row['pct']:.0f}%",
            textposition='inside',
            textfont=dict(size=10, color='white' if i < 3 else COLORS['text']),
            hovertemplate=f"{row['channel']}: {row['count']:,} ({row['pct']:.1f}%)<extra></extra>"
        ))

    fig_channel.update_layout(
        barmode='stack',
        height=80,
        margin=dict(l=0, r=0, t=0, b=0),
        paper_bgcolor='white',
        plot_bgcolor='white',
        showlegend=False,
        xaxis=dict(visible=False),
        yaxis=dict(visible=False)
    )
    st.plotly_chart(fig_channel, use_container_width=True, config={'displayModeBar': False})

    st.markdown("##### Status Breakdown")
    st.markdown(f"""
    | Status | Count |
    |--------|------:|
    | Closed | 301,350 |
    | Open | 19,468 |
    | In Progress | 9,308 |
    | Other | 1,976 |
    """)

    st.markdown("##### Notable Patterns")
    st.markdown("""
    - **Heat/Hot Water** dominates (19%) — typical winter pattern
    - **Noise complaints** resolve fastest (<2 hrs median)
    - **Unsanitary Condition** has lowest resolution (58%)
    - **Helicopter Noise** gets 0% resolution (routed to EDC)
    """)

# -----------------------------------------------------------------------------
# Row 3: Agency & Borough Performance - Small Multiples
# -----------------------------------------------------------------------------
st.markdown("---")
st.markdown("## Response Performance")

col_agency, col_borough = st.columns(2)

with col_agency:
    # Agency performance - slope chart style (Tufte's favorite)
    fig_agency = make_subplots(
        rows=1, cols=2,
        column_widths=[0.6, 0.4],
        subplot_titles=('Request Volume', 'Median Response (hrs)'),
        horizontal_spacing=0.15
    )

    df = agency_data.sort_values('count', ascending=True)

    # Volume bars
    fig_agency.add_trace(go.Bar(
        y=df['name'],
        x=df['count'],
        orientation='h',
        marker_color=COLORS['primary'],
        text=[f"{v:,.0f}" for v in df['count']],
        textposition='outside',
        textfont=dict(size=9),
        hovertemplate='%{y}: %{x:,.0f} requests<extra></extra>'
    ), row=1, col=1)

    # Response time - lollipop chart
    fig_agency.add_trace(go.Scatter(
        y=df['name'],
        x=df['median_hours'],
        mode='markers+text',
        marker=dict(
            size=12,
            color=[COLORS['success'] if h < 10 else COLORS['accent'] if h > 40 else COLORS['secondary']
                   for h in df['median_hours']]
        ),
        text=[f"{h:.1f}" for h in df['median_hours']],
        textposition='middle right',
        textfont=dict(size=9),
        hovertemplate='%{y}: %{x:.1f} hrs median<extra></extra>'
    ), row=1, col=2)

    # Add reference line at 24 hrs
    fig_agency.add_vline(x=24, line_dash="dot", line_color="#ddd", row=1, col=2)
    fig_agency.add_annotation(x=24, y=9.5, text="24h", showarrow=False,
                              font=dict(size=8, color='#999'), row=1, col=2)

    tufte_layout(fig_agency, "Agency Performance", height=350)
    fig_agency.update_xaxes(title_text=None)
    fig_agency.update_yaxes(title_text=None)
    st.plotly_chart(fig_agency, use_container_width=True, config={'displayModeBar': False})

with col_borough:
    # Borough comparison - bullet chart style
    fig_borough = go.Figure()

    df = borough_data.sort_values('count', ascending=True)

    # Create grouped comparison
    for i, row in df.iterrows():
        # Volume bar (normalized to show relative size)
        fig_borough.add_trace(go.Bar(
            y=[row['borough']],
            x=[row['count']],
            orientation='h',
            marker_color=COLORS['primary'],
            opacity=0.8,
            text=f"{row['count']:,.0f}",
            textposition='outside',
            textfont=dict(size=9),
            hovertemplate=f"{row['borough']}<br>Requests: {row['count']:,}<br>Resolution: {row['resolution_rate']}%<br>Median: {row['median_hours']:.1f}hrs<extra></extra>"
        ))

    tufte_layout(fig_borough, "Borough Volume", height=250)
    st.plotly_chart(fig_borough, use_container_width=True, config={'displayModeBar': False})

    # Borough response times as simple table (high data-ink ratio)
    st.markdown("##### Response Times by Borough")
    st.markdown(f"""
    | Borough | Median | Resolution |
    |---------|-------:|----------:|
    | Brooklyn | **2.9 hrs** | 92.0% |
    | Queens | 3.3 hrs | 93.0% |
    | Manhattan | 4.0 hrs | 86.9% |
    | Bronx | 22.4 hrs | 93.8% |
    | Staten Island | 22.8 hrs | 93.7% |
    """)

# -----------------------------------------------------------------------------
# Row 4: Temporal Patterns - Small Multiples by Week
# -----------------------------------------------------------------------------
st.markdown("---")
st.markdown("## Temporal Patterns")

# Weekly heatmap - small multiple approach
col_weekly, col_dow = st.columns([2, 1])

with col_weekly:
    # Reshape for heatmap
    daily_data['day_num'] = daily_data['date'].dt.day
    daily_data['weekday'] = daily_data['date'].dt.dayofweek

    # Create week-by-day matrix
    weeks = []
    for week_num in daily_data['week'].unique():
        week_data = daily_data[daily_data['week'] == week_num].sort_values('weekday')
        weeks.append(week_data['count'].values)

    # Pad weeks to same length
    week_matrix = np.zeros((5, 7))
    day_labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    week_labels = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5']

    for i, week_num in enumerate(sorted(daily_data['week'].unique())):
        week_subset = daily_data[daily_data['week'] == week_num].sort_values('weekday')
        for _, row in week_subset.iterrows():
            if row['weekday'] < 7:
                week_matrix[i, row['weekday']] = row['count']

    fig_heatmap = go.Figure(data=go.Heatmap(
        z=week_matrix,
        x=day_labels,
        y=week_labels,
        colorscale=[[0, '#f7f7f7'], [0.5, '#a8c4db'], [1, COLORS['primary']]],
        showscale=False,
        text=[[f"{int(v):,}" if v > 0 else "" for v in row] for row in week_matrix],
        texttemplate="%{text}",
        textfont=dict(size=10),
        hovertemplate='%{y}, %{x}<br>%{z:,.0f} requests<extra></extra>'
    ))

    tufte_layout(fig_heatmap, "Daily Volume by Week (darker = more requests)", height=220)
    st.plotly_chart(fig_heatmap, use_container_width=True, config={'displayModeBar': False})

with col_dow:
    # Day of week averages
    dow_avg = daily_data.groupby('day_of_week')['count'].mean().reindex(
        ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    )

    fig_dow = go.Figure()
    colors = [COLORS['primary'] if d in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']
              else COLORS['secondary'] for d in dow_avg.index]

    fig_dow.add_trace(go.Bar(
        x=[d[:3] for d in dow_avg.index],
        y=dow_avg.values,
        marker_color=colors,
        text=[f"{v:,.0f}" for v in dow_avg.values],
        textposition='outside',
        textfont=dict(size=9),
        hovertemplate='%{x}: %{y:,.0f} avg<extra></extra>'
    ))

    # Add average line
    fig_dow.add_hline(y=dow_avg.mean(), line_dash="dot", line_color="#ccc",
                      annotation_text=f"avg: {dow_avg.mean():,.0f}",
                      annotation_position="right")

    tufte_layout(fig_dow, "Avg Volume by Day", height=220)
    st.plotly_chart(fig_dow, use_container_width=True, config={'displayModeBar': False})

# -----------------------------------------------------------------------------
# Row 5: Geographic Distribution
# -----------------------------------------------------------------------------
st.markdown("---")
st.markdown("## Geographic Distribution")

col_map, col_detail = st.columns([1, 1])

with col_map:
    # Top complaints by borough - Tufte small multiples
    st.markdown("##### Top Complaint by Borough")

    borough_top = pd.DataFrame({
        'Borough': ['Bronx', 'Brooklyn', 'Manhattan', 'Queens', 'Staten Island'],
        'Top Issue': ['Noise-Residential', 'Illegal Parking', 'Heat/Hot Water',
                      'Illegal Parking', 'Illegal Parking'],
        'Count': [37472, 17623, 15586, 13828, 1331],
        '% of Borough': [38.9, 18.8, 25.3, 19.9, 12.1]
    })

    fig_boro_top = go.Figure()

    for i, row in borough_top.iterrows():
        fig_boro_top.add_trace(go.Bar(
            x=[row['Count']],
            y=[row['Borough']],
            orientation='h',
            marker_color=COLORS['primary'] if row['Top Issue'] != 'Noise-Residential' else COLORS['accent'],
            text=f"{row['Top Issue']} ({row['% of Borough']:.0f}%)",
            textposition='inside',
            textfont=dict(color='white', size=10),
            hovertemplate=f"{row['Borough']}<br>{row['Top Issue']}: {row['Count']:,}<extra></extra>"
        ))

    tufte_layout(fig_boro_top, height=220)
    fig_boro_top.update_layout(showlegend=False)
    st.plotly_chart(fig_boro_top, use_container_width=True, config={'displayModeBar': False})

with col_detail:
    st.markdown("##### Key Geographic Insights")
    st.markdown("""
    **Bronx leads in volume** despite having ~17% of NYC population:
    - 96,322 requests (29% of total)
    - Noise complaints dominate (39% of Bronx requests)
    - Slower median response (22.4 hrs vs 2.9 hrs in Brooklyn)

    **Brooklyn has fastest response** (2.9 hr median):
    - High volume (93,503) but efficient processing
    - Illegal parking is top issue

    **Manhattan encampment complaints** are notable:
    - 2,135 encampment reports (highest of any borough)
    - Vendor enforcement also concentrated here (1,192)
    """)

# -----------------------------------------------------------------------------
# Footer: Data Source & Methodology
# -----------------------------------------------------------------------------
st.markdown("---")
st.markdown("""
<div style='font-size: 0.8rem; color: #888; padding: 1rem 0;'>
<strong>Data Source:</strong> NYC Open Data - 311 Service Requests from 2020 to Present (erm2-nwe9)<br>
<strong>Time Period:</strong> December 1-31, 2025 · <strong>Total Records:</strong> 332,102<br>
<strong>Design Principles:</strong> Following Edward Tufte's guidelines — maximizing data-ink ratio,
eliminating chartjunk, using direct labels over legends, and employing small multiples for comparison.<br>
<strong>Response Time Notes:</strong> Calculated from sample of 5,000 closed requests.
Median used over mean to reduce outlier influence.
</div>
""", unsafe_allow_html=True)
