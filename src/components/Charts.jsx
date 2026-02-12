import React from 'react';
import InfoTooltip from './InfoTooltip';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList
} from 'recharts';

// Trend Line Chart for performance over time
export const TrendChart = ({ data, dataKeys, colors, title, infoText }) => {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <InfoTooltip text={infoText} />
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="name" 
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}
          />
          <Legend />
          {dataKeys.map((key, index) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={colors[index]}
              strokeWidth={2}
              dot={{ fill: colors[index], r: 4 }}
              activeDot={{ r: 6 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// Bar Chart for KPI comparison
export const KPIBarChart = ({ data, title, infoText }) => {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        <InfoTooltip text={infoText} />
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="name" 
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}
          />
          <Legend />
          <Bar dataKey="value" fill="#3b82f6" radius={[8, 8, 0, 0]} />
          <Bar dataKey="target" fill="#e5e7eb" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

// Donut Chart for score distribution
export const ScoreDistributionChart = ({ data, title, infoText, footer = null }) => {
  const COLORS = ['#22c55e', '#eab308', '#ef4444', '#6b7280'];
  const RADIAN = Math.PI / 180;
  const innerRadius = 50;
  const outerRadius = 70;
  const labelOffset = 14;

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload || payload.length === 0) return null;
    const { name, value, kpis } = payload[0].payload || {};

    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-md p-3 text-xs text-gray-700">
        <div className="font-semibold text-gray-900 mb-1">{name}</div>
        <div className="mb-2">Count: <span className="font-semibold">{value}</span></div>
        {Array.isArray(kpis) && kpis.length > 0 && (
          <div>
            <div className="text-[11px] text-gray-500 mb-1">KPIs in this category</div>
            <div className="flex flex-wrap gap-1">
              {kpis.map((kpi) => (
                <span key={kpi} className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                  {kpi}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  // Custom label renderer to show values and avoid clipping at the top
  const renderLabel = ({ cx, cy, midAngle, value }) => {
    if (value === 0) return null;
    const radius = outerRadius + labelOffset;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const anchor = x > cx ? 'start' : 'end';
    const dy = y < cy ? -2 : 2;
    return (
      <text
        x={x}
        y={y}
        fill="#111827"
        textAnchor={anchor}
        dominantBaseline="central"
        style={{ fontSize: '10px', fontWeight: 700 }}
        dy={dy}
      >
        {value}
      </text>
    );
  };

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <InfoTooltip text={infoText} />
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart margin={{ top: 16, right: 12, bottom: 8, left: 12 }}>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            fill="#8884d8"
            paddingAngle={2}
            dataKey="value"
            label={renderLabel}
            labelLine={{ stroke: '#d1d5db', strokeWidth: 1 }}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip 
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}
            content={<CustomTooltip />}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="mt-1 flex items-center justify-center gap-4 flex-wrap">
        {data.map((entry, index) => (
          <div key={entry.name} className="flex items-center gap-1.5 text-xs">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: COLORS[index % COLORS.length] }}
            />
            <span className="text-gray-700">{entry.name}: <span className="font-semibold">{entry.value}</span></span>
          </div>
        ))}
      </div>
      {footer ? <div className="mt-2">{footer}</div> : null}
    </div>
  );
};

// Historical Apptivia Scores Line Chart
export const HistoricalScoresChart = ({ data, title, infoText }) => {
  return (
    <div className="bg-white rounded-lg p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <InfoTooltip text={infoText} />
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis 
            dataKey="week" 
            stroke="#6b7280"
            style={{ fontSize: '10px' }}
          />
          <YAxis 
            stroke="#6b7280"
            style={{ fontSize: '10px' }}
            domain={[0, 100]}
          />
          <Tooltip 
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
              fontSize: '11px'
            }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            height={24}
            wrapperStyle={{ fontSize: '11px' }}
          />
          <Line
            type="monotone"
            dataKey="score"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ fill: '#3b82f6', r: 3 }}
            activeDot={{ r: 5 }}
            name="Apptivia Score"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// Team Performance Bar Chart
export const TeamPerformanceChart = ({
  data,
  title,
  infoText,
  dataKey = 'score',
  barLabel = 'Apptivia Score',
  xDomain,
  xTickFormatter,
}) => {
  const chartHeight = Math.max(220, (data?.length || 0) * 32 + 40);
  const domain = xDomain || [0, 'dataMax'];
  return (
    <div className="bg-white rounded-lg p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold">{title}</h3>
        <InfoTooltip text={infoText} />
      </div>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 24, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            type="number"
            stroke="#6b7280"
            style={{ fontSize: '12px' }}
            domain={domain}
            tickFormatter={xTickFormatter}
          />
          <YAxis
            dataKey="name"
            type="category"
            width={140}
            interval={0}
            stroke="#6b7280"
            style={{ fontSize: '11px' }}
          />
          <Tooltip
            formatter={(value) => xTickFormatter ? xTickFormatter(value) : value}
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}
          />
          <Legend />
          <Bar dataKey={dataKey} fill="#3b82f6" radius={[0, 8, 8, 0]} name={barLabel}>
            <LabelList
              dataKey={dataKey}
              position="right"
              formatter={(value) => xTickFormatter ? xTickFormatter(value) : value}
              style={{ fill: '#111827', fontSize: '11px', fontWeight: 600 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default { TrendChart, KPIBarChart, ScoreDistributionChart, TeamPerformanceChart };
