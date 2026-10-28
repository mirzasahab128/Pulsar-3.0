import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { 
  TrendingUp, 
  ShieldCheck, 
  Sparkles, 
  Calendar, 
  Layers, 
  Maximize2, 
  Eye, 
  Info,
  DollarSign,
  ArrowUpRight,
  Activity
} from 'lucide-react';
import { NicheTemplate } from '../data/nicheTemplates';

export interface D3RevenueDataPoint {
  monthIndex: number;
  monthLabel: string;
  quarterLabel: string;
  denialRecovery: number; // in dollars
  arCashBenefit: number;  // in dollars
  netRevenueIncrease: number; // in dollars
  cumulativeDenial: number;
  cumulativeNetRevenue: number;
  collectionRate: number; // in percentage e.g. 94.2%
}

interface D3RevenueVelocityChartProps {
  monthlyClaimsBilled: number;
  currentDenialRate: number;
  pulsarOverturnRate: number;
  monthlyDenialRecovery: number;
  monthlyArCashBenefit: number;
  totalMonthlyNetImprovement: number;
  improvedNetCollectionRate: number;
  baselineNetCollectionRate: number;
  practiceSpecialty?: string;
  nicheTemplate?: NicheTemplate;
  isDark?: boolean;
}

export const D3RevenueVelocityChart: React.FC<D3RevenueVelocityChartProps> = ({
  monthlyClaimsBilled,
  currentDenialRate,
  pulsarOverturnRate,
  monthlyDenialRecovery,
  monthlyArCashBenefit,
  totalMonthlyNetImprovement,
  improvedNetCollectionRate,
  baselineNetCollectionRate,
  practiceSpecialty = 'Cardiology',
  nicheTemplate,
  isDark = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // User Interactive View States
  const [timelineMonths, setTimelineMonths] = useState<6 | 12 | 18 | 24>(12);
  const [metricViewMode, setMetricViewMode] = useState<'monthly' | 'cumulative'>('monthly');
  const [activeSeries, setActiveSeries] = useState<'both' | 'denial' | 'netRevenue'>('both');
  const [hoveredPoint, setHoveredPoint] = useState<D3RevenueDataPoint | null>(null);

  // Month names generator starting from current month
  const timelineData = useMemo(() => {
    const data: D3RevenueDataPoint[] = [];
    const now = new Date();
    
    let cumDenial = 0;
    let cumNet = 0;

    for (let i = 0; i < timelineMonths; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthLabel = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      const quarterLabel = `Q${Math.floor(d.getMonth() / 3) + 1} '${d.getFullYear().toString().slice(2)}`;

      // Adoption curve: Month 1 starts at 60% capacity during initial AI indexing & training,
      // ramping to 90% by Month 3, and achieving full steady-state velocity + compounding gains
      const rampFactor = i === 0 ? 0.62 : i === 1 ? 0.78 : i === 2 ? 0.92 : 1.0 + (i - 3) * 0.015;
      
      const denial = Math.round(monthlyDenialRecovery * rampFactor);
      const arBenefit = Math.round(monthlyArCashBenefit * rampFactor);
      const net = denial + arBenefit;

      cumDenial += denial;
      cumNet += net;

      const rateGain = Math.min(15, (net / Math.max(1, monthlyClaimsBilled)) * 100);
      const collectionRate = parseFloat(Math.min(99.2, baselineNetCollectionRate + rateGain).toFixed(1));

      data.push({
        monthIndex: i,
        monthLabel,
        quarterLabel,
        denialRecovery: denial,
        arCashBenefit: arBenefit,
        netRevenueIncrease: net,
        cumulativeDenial: cumDenial,
        cumulativeNetRevenue: cumNet,
        collectionRate,
      });
    }

    return data;
  }, [
    timelineMonths,
    monthlyDenialRecovery,
    monthlyArCashBenefit,
    monthlyClaimsBilled,
    baselineNetCollectionRate,
  ]);

  // Main D3 Rendering Engine
  useEffect(() => {
    if (!svgRef.current || !containerRef.current || timelineData.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clean redraw

    const bounds = containerRef.current.getBoundingClientRect();
    const width = Math.max(340, bounds.width);
    const height = Math.min(420, Math.max(320, width * 0.44));

    const margin = { 
      top: 30, 
      right: width > 640 ? 40 : 20, 
      bottom: 45, 
      left: width > 640 ? 65 : 45 
    };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    svg
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('width', '100%')
      .attr('height', height)
      .style('overflow', 'visible');

    // Defs: Gradients and Filters
    const defs = svg.append('defs');

    // 1. Denial Recovery Gradient (Healthcare Teal #0D9488)
    const denialGradient = defs
      .append('linearGradient')
      .attr('id', 'pulsar-d3-denial-grad')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    denialGradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#0D9488')
      .attr('stop-opacity', isDark ? 0.45 : 0.28);

    denialGradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#0D9488')
      .attr('stop-opacity', 0.0);

    // 2. Net Revenue Increase Gradient (Intelligent Cyan #38BDF8 to Trust Blue #2563EB)
    const netRevenueGradient = defs
      .append('linearGradient')
      .attr('id', 'pulsar-d3-netrev-grad')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');

    netRevenueGradient
      .append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#38BDF8')
      .attr('stop-opacity', isDark ? 0.55 : 0.35);

    netRevenueGradient
      .append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#2563EB')
      .attr('stop-opacity', 0.0);

    // 3. Drop Shadow Filter for Lines
    const glowFilter = defs.append('filter').attr('id', 'pulsar-d3-glow').attr('x', '-20%').attr('y', '-20%').attr('width', '140%').attr('height', '140%');
    glowFilter.append('feGaussianBlur').attr('stdDeviation', 3).attr('result', 'blur');
    glowFilter.append('feComposite').attr('in', 'SourceGraphic').attr('in2', 'blur').attr('operator', 'over');

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // X Scale
    const xScale = d3
      .scalePoint<string>()
      .domain(timelineData.map((d) => d.monthLabel))
      .range([0, innerWidth])
      .padding(0.15);

    // Y Scale Domain calculation based on view mode
    const maxValue = d3.max(timelineData, (d) => {
      if (metricViewMode === 'cumulative') {
        return Math.max(d.cumulativeNetRevenue, d.cumulativeDenial);
      }
      return Math.max(d.netRevenueIncrease, d.denialRecovery);
    }) || 100000;

    const yScale = d3
      .scaleLinear()
      .domain([0, maxValue * 1.15])
      .range([innerHeight, 0])
      .nice();

    // Horizontal Grid Lines
    const yGrid = d3.axisLeft(yScale).ticks(5).tickSize(-innerWidth).tickFormat(() => '');
    g.append('g')
      .attr('class', 'grid')
      .call(yGrid)
      .selectAll('line')
      .attr('stroke', isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)')
      .attr('stroke-dasharray', '3,3');
    g.select('.grid .domain').remove();

    // D3 Area Generators
    const denialArea = d3
      .area<D3RevenueDataPoint>()
      .x((d) => xScale(d.monthLabel) || 0)
      .y0(innerHeight)
      .y1((d) => yScale(metricViewMode === 'cumulative' ? d.cumulativeDenial : d.denialRecovery))
      .curve(d3.curveMonotoneX);

    const netRevenueArea = d3
      .area<D3RevenueDataPoint>()
      .x((d) => xScale(d.monthLabel) || 0)
      .y0(innerHeight)
      .y1((d) => yScale(metricViewMode === 'cumulative' ? d.cumulativeNetRevenue : d.netRevenueIncrease))
      .curve(d3.curveMonotoneX);

    // D3 Line Generators
    const denialLine = d3
      .line<D3RevenueDataPoint>()
      .x((d) => xScale(d.monthLabel) || 0)
      .y((d) => yScale(metricViewMode === 'cumulative' ? d.cumulativeDenial : d.denialRecovery))
      .curve(d3.curveMonotoneX);

    const netRevenueLine = d3
      .line<D3RevenueDataPoint>()
      .x((d) => xScale(d.monthLabel) || 0)
      .y((d) => yScale(metricViewMode === 'cumulative' ? d.cumulativeNetRevenue : d.netRevenueIncrease))
      .curve(d3.curveMonotoneX);

    // Render Areas & Lines depending on activeSeries toggle
    if (activeSeries === 'both' || activeSeries === 'denial') {
      // Area Fill
      g.append('path')
        .datum(timelineData)
        .attr('fill', 'url(#pulsar-d3-denial-grad)')
        .attr('d', denialArea);

      // Stroke Path
      g.append('path')
        .datum(timelineData)
        .attr('fill', 'none')
        .attr('stroke', '#0D9488')
        .attr('stroke-width', 2.5)
        .attr('stroke-linecap', 'round')
        .attr('d', denialLine);
    }

    if (activeSeries === 'both' || activeSeries === 'netRevenue') {
      // Area Fill
      g.append('path')
        .datum(timelineData)
        .attr('fill', 'url(#pulsar-d3-netrev-grad)')
        .attr('d', netRevenueArea);

      // Stroke Path with glow
      g.append('path')
        .datum(timelineData)
        .attr('fill', 'none')
        .attr('stroke', '#38BDF8')
        .attr('stroke-width', 3)
        .attr('stroke-linecap', 'round')
        .attr('filter', isDark ? 'url(#pulsar-d3-glow)' : null)
        .attr('d', netRevenueLine);
    }

    // Axes
    const xAxis = d3.axisBottom(xScale).tickSize(0).tickPadding(10);
    const yAxis = d3
      .axisLeft(yScale)
      .ticks(5)
      .tickSize(0)
      .tickPadding(8)
      .tickFormat((d) => {
        const val = Number(d);
        if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
        if (val >= 1000) return `$${Math.round(val / 1000)}k`;
        return `$${val}`;
      });

    const xAxisGroup = g
      .append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(xAxis);

    xAxisGroup.select('.domain').attr('stroke', isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)');
    xAxisGroup
      .selectAll('text')
      .attr('fill', isDark ? '#94A3B8' : '#64748B')
      .attr('font-size', '11px')
      .attr('font-weight', '600')
      .attr('font-family', 'sans-serif');

    const yAxisGroup = g.append('g').call(yAxis);
    yAxisGroup.select('.domain').remove();
    yAxisGroup
      .selectAll('text')
      .attr('fill', isDark ? '#94A3B8' : '#64748B')
      .attr('font-size', '11px')
      .attr('font-family', 'monospace')
      .attr('font-weight', 'bold');

    // Data Point Dots
    timelineData.forEach((d) => {
      const cx = xScale(d.monthLabel) || 0;
      
      if (activeSeries === 'both' || activeSeries === 'denial') {
        const cyDenial = yScale(metricViewMode === 'cumulative' ? d.cumulativeDenial : d.denialRecovery);
        g.append('circle')
          .attr('cx', cx)
          .attr('cy', cyDenial)
          .attr('r', 3.5)
          .attr('fill', '#0D9488')
          .attr('stroke', isDark ? '#0B1220' : '#FFFFFF')
          .attr('stroke-width', 2);
      }

      if (activeSeries === 'both' || activeSeries === 'netRevenue') {
        const cyNet = yScale(metricViewMode === 'cumulative' ? d.cumulativeNetRevenue : d.netRevenueIncrease);
        g.append('circle')
          .attr('cx', cx)
          .attr('cy', cyNet)
          .attr('r', 4.5)
          .attr('fill', '#38BDF8')
          .attr('stroke', isDark ? '#0B1220' : '#FFFFFF')
          .attr('stroke-width', 2);
      }
    });

    // Crosshair Hover Indicator Line & Overlay
    const hoverLine = g
      .append('line')
      .attr('y1', 0)
      .attr('y2', innerHeight)
      .attr('stroke', isDark ? 'rgba(56, 189, 248, 0.45)' : 'rgba(37, 99, 235, 0.35)')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '4,4')
      .style('opacity', 0);

    const highlightCircleNet = g
      .append('circle')
      .attr('r', 6)
      .attr('fill', '#38BDF8')
      .attr('stroke', isDark ? '#FFFFFF' : '#0B1220')
      .attr('stroke-width', 2.5)
      .style('opacity', 0);

    const highlightCircleDenial = g
      .append('circle')
      .attr('r', 5)
      .attr('fill', '#0D9488')
      .attr('stroke', isDark ? '#FFFFFF' : '#0B1220')
      .attr('stroke-width', 2)
      .style('opacity', 0);

    // Transparent mouse tracking overlay
    const overlay = g
      .append('rect')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair');

    overlay
      .on('mousemove', function (event: MouseEvent) {
        const [mouseX] = d3.pointer(event);
        const eachBand = innerWidth / timelineData.length;
        const index = Math.min(
          timelineData.length - 1,
          Math.max(0, Math.floor(mouseX / eachBand))
        );
        const point = timelineData[index];
        if (!point) return;

        setHoveredPoint(point);

        const xPos = xScale(point.monthLabel) || 0;
        hoverLine.attr('x1', xPos).attr('x2', xPos).style('opacity', 1);

        if (activeSeries === 'both' || activeSeries === 'netRevenue') {
          const cyNet = yScale(metricViewMode === 'cumulative' ? point.cumulativeNetRevenue : point.netRevenueIncrease);
          highlightCircleNet.attr('cx', xPos).attr('cy', cyNet).style('opacity', 1);
        } else {
          highlightCircleNet.style('opacity', 0);
        }

        if (activeSeries === 'both' || activeSeries === 'denial') {
          const cyDenial = yScale(metricViewMode === 'cumulative' ? point.cumulativeDenial : point.denialRecovery);
          highlightCircleDenial.attr('cx', xPos).attr('cy', cyDenial).style('opacity', 1);
        } else {
          highlightCircleDenial.style('opacity', 0);
        }
      })
      .on('mouseleave', function () {
        setHoveredPoint(null);
        hoverLine.style('opacity', 0);
        highlightCircleNet.style('opacity', 0);
        highlightCircleDenial.style('opacity', 0);
      });
  }, [
    timelineData,
    timelineMonths,
    metricViewMode,
    activeSeries,
    isDark,
  ]);

  // Dynamic context title based on active template
  const nicheBadge = nicheTemplate ? nicheTemplate.name : 'All Industries';
  const nicheImpact = nicheTemplate?.agentConfig?.revenueImpact || '$550k - $2.5M / mo Volume';

  return (
    <div className={`p-4 sm:p-5 rounded-3xl border transition-all duration-300 relative overflow-hidden backdrop-blur-2xl space-y-4 ${
      isDark 
        ? 'bg-slate-900/90 border-teal-500/30 shadow-2xl shadow-teal-500/5' 
        : 'bg-white border-teal-500/25 shadow-xl shadow-teal-600/5'
    }`}>
      {/* Top Ambient Highlight */}
      <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-teal-500 via-cyan-400 to-blue-600 opacity-90" />

      {/* Header and Controls Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-teal-500/15">
        <div>
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-400 text-[11px] font-bold uppercase tracking-wider">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>D3 Interactive Velocity Engine</span>
            </span>
            <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
              Active Niche: <strong className="text-teal-400 dark:text-teal-300 font-semibold">{nicheBadge}</strong>
            </span>
          </div>

          <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            <span>Denial Recovery & Net Revenue Increase Trajectory</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xl">
            Interactive D3 visualization tracking compounding monthly claim overturns and total practice cash acceleration over time.
          </p>
        </div>

        {/* Timeline & View Mode Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Horizon Selector (6M, 12M, 18M, 24M) */}
          <div className={`flex items-center p-0.5 rounded-xl border text-xs font-semibold ${
            isDark ? 'bg-slate-950/80 border-slate-700/60' : 'bg-slate-100 border-slate-200'
          }`}>
            {([6, 12, 18, 24] as const).map((months) => (
              <button
                key={months}
                type="button"
                onClick={() => setTimelineMonths(months)}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                  timelineMonths === months
                    ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 font-bold shadow-sm'
                    : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {months}M
              </button>
            ))}
          </div>

          {/* Metric View: Monthly vs Cumulative */}
          <div className={`flex items-center p-0.5 rounded-xl border text-xs font-semibold ${
            isDark ? 'bg-slate-950/80 border-slate-700/60' : 'bg-slate-100 border-slate-200'
          }`}>
            <button
              type="button"
              onClick={() => setMetricViewMode('monthly')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                metricViewMode === 'monthly'
                  ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 font-bold shadow-sm'
                  : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Monthly Run-Rate
            </button>
            <button
              type="button"
              onClick={() => setMetricViewMode('cumulative')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                metricViewMode === 'cumulative'
                  ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-slate-950 font-bold shadow-sm'
                  : isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Cumulative Total
            </button>
          </div>
        </div>
      </div>

      {/* Series Filters & Live Hover Telemetry Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        {/* Series Filter Buttons */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">Series:</span>
          
          <button
            type="button"
            onClick={() => setActiveSeries('both')}
            className={`px-2.5 py-1 rounded-lg border font-semibold text-[11px] transition cursor-pointer ${
              activeSeries === 'both'
                ? 'bg-teal-500/20 border-teal-500 text-teal-400'
                : isDark ? 'bg-slate-800/60 border-white/5 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}
          >
            All Curves
          </button>

          <button
            type="button"
            onClick={() => setActiveSeries('netRevenue')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold text-[11px] transition cursor-pointer ${
              activeSeries === 'netRevenue'
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300'
                : isDark ? 'bg-slate-800/60 border-white/5 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#38BDF8]" />
            <span>Net Revenue Increase</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSeries('denial')}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-semibold text-[11px] transition cursor-pointer ${
              activeSeries === 'denial'
                ? 'bg-teal-500/20 border-teal-400 text-teal-300'
                : isDark ? 'bg-slate-800/60 border-white/5 text-slate-400' : 'bg-slate-50 border-slate-200 text-slate-600'
            }`}
          >
            <span className="w-2 h-2 rounded-full bg-[#0D9488]" />
            <span>Denial Recovery Overturns</span>
          </button>
        </div>

        {/* Hover Snapshot Telemetry */}
        <div className="font-mono text-[11px] flex items-center gap-3">
          {hoveredPoint ? (
            <div className="flex items-center gap-3 text-slate-200">
              <span className="text-slate-400 font-bold">{hoveredPoint.monthLabel}:</span>
              <span className="text-cyan-400 font-bold">
                Net: ${metricViewMode === 'cumulative' ? hoveredPoint.cumulativeNetRevenue.toLocaleString() : hoveredPoint.netRevenueIncrease.toLocaleString()}
              </span>
              <span className="text-teal-400 font-bold">
                Denial: ${metricViewMode === 'cumulative' ? hoveredPoint.cumulativeDenial.toLocaleString() : hoveredPoint.denialRecovery.toLocaleString()}
              </span>
              <span className="text-emerald-400">
                Rate: {hoveredPoint.collectionRate}%
              </span>
            </div>
          ) : (
            <span className="text-slate-500 flex items-center gap-1">
              <Info className="w-3.5 h-3.5" />
              <span>Hover over any month on the chart for instant precision audit breakdown</span>
            </span>
          )}
        </div>
      </div>

      {/* Main D3 SVG Chart Container */}
      <div 
        ref={containerRef}
        className={`w-full rounded-2xl border relative overflow-hidden transition-all ${
          isDark ? 'bg-slate-950/70 border-white/10' : 'bg-[#F8FAFC] border-slate-200'
        }`}
      >
        <svg ref={svgRef} className="w-full h-auto block" />
      </div>

      {/* Bottom KPI Trajectory Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
        {/* Card 1: 12-Month Projected Net Injection */}
        <div className={`p-3.5 rounded-xl border ${
          isDark ? 'bg-slate-950/60 border-teal-500/20' : 'bg-teal-50/60 border-teal-200'
        }`}>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">
            <span>{timelineMonths}-Month Net Gain</span>
            <Sparkles className="w-3.5 h-3.5 text-teal-400" />
          </div>
          <div className="text-xl font-black font-mono text-teal-400">
            +${(timelineData[timelineData.length - 1]?.cumulativeNetRevenue || 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            Compounded recovery & AR acceleration
          </div>
        </div>

        {/* Card 2: Cumulative Denial Pool Overturn */}
        <div className={`p-3.5 rounded-xl border ${
          isDark ? 'bg-slate-950/60 border-cyan-500/20' : 'bg-cyan-50/60 border-cyan-200'
        }`}>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">
            <span>Cumulative Denials Overturned</span>
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-xl font-black font-mono text-cyan-400">
            +${(timelineData[timelineData.length - 1]?.cumulativeDenial || 0).toLocaleString()}
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            Based on {pulsarOverturnRate}% autonomous win rate
          </div>
        </div>

        {/* Card 3: Collection Efficiency Rate */}
        <div className={`p-3.5 rounded-xl border ${
          isDark ? 'bg-slate-950/60 border-emerald-500/20' : 'bg-emerald-50/60 border-emerald-200'
        }`}>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">
            <span>Peak Net Collection Rate</span>
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-black font-mono text-emerald-400">
            {improvedNetCollectionRate}%
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            Up from baseline {baselineNetCollectionRate}% (+{(improvedNetCollectionRate - baselineNetCollectionRate).toFixed(1)}%)
          </div>
        </div>

        {/* Card 4: Monthly Run Rate at Steady State */}
        <div className={`p-3.5 rounded-xl border ${
          isDark ? 'bg-slate-950/60 border-blue-500/20' : 'bg-blue-50/60 border-blue-200'
        }`}>
          <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">
            <span>Target Monthly Cash Flow</span>
            <DollarSign className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-xl font-black font-mono text-blue-400">
            +${totalMonthlyNetImprovement.toLocaleString()} / mo
          </div>
          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
            ${(totalMonthlyNetImprovement * 12).toLocaleString()} annualized
          </div>
        </div>
      </div>
    </div>
  );
};
