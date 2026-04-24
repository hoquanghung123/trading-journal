import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  AreaChart,
  Area,
  PieChart,
  Pie,
} from "recharts";

const COLORS = {
  primary: "#4C763B", // Forest Green
  primaryLight: "#B0CE88", // Sage Green
  emerald: "#10b981",
  red: "#f43f5e",
  grid: "rgba(0, 0, 0, 0.05)",
  gridDark: "rgba(255, 255, 255, 0.05)",
  text: "#64748B",
};

interface ChartProps {
  data: any[];
  height?: number;
}

export function EquityCurveChart({ data, height = 300 }: ChartProps) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="colorPnl" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={COLORS.primary} stopOpacity={0.2} />
              <stop offset="95%" stopColor={COLORS.primary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.grid} className="dark:stroke-white/5" />
          <XAxis
            dataKey="name"
            stroke={COLORS.text}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tick={{ fill: COLORS.text }}
          />
          <YAxis
            stroke={COLORS.text}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `$${value}`}
            tick={{ fill: COLORS.text }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#FFF",
              border: "1px solid rgba(0, 0, 0, 0.05)",
              borderRadius: "12px",
              boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
              fontSize: "12px",
            }}
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={COLORS.primary}
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorPnl)"
            animationDuration={1500}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MonthlyPnlBarChart({ data, height = 300 }: ChartProps) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.grid} className="dark:stroke-white/5" />
          <XAxis
            dataKey="name"
            stroke={COLORS.text}
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke={COLORS.text}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip
            cursor={{ fill: "rgba(0, 0, 0, 0.02)" }}
            contentStyle={{
              backgroundColor: "#FFF",
              border: "1px solid rgba(0, 0, 0, 0.05)",
              borderRadius: "12px",
              fontSize: "12px",
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} animationDuration={1000}>
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.value >= 0 ? COLORS.primary : COLORS.red} 
                fillOpacity={0.8} 
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WinLossDonutChart({ data, height = 200 }: ChartProps) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            innerRadius={60}
            outerRadius={80}
            paddingAngle={5}
            dataKey="value"
            stroke="none"
            animationDuration={1000}
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={index === 0 ? COLORS.primary : COLORS.red} fillOpacity={0.8} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SetupPerformanceChart({ data, height = 250 }: ChartProps) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={COLORS.grid} className="dark:stroke-white/5" />
          <XAxis
            type="number"
            stroke={COLORS.text}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `$${value}`}
          />
          <YAxis
            dataKey="name"
            type="category"
            stroke={COLORS.text}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            width={80}
          />
          <Tooltip
            cursor={{ fill: "rgba(0, 0, 0, 0.02)" }}
            contentStyle={{
              backgroundColor: "#FFF",
              border: "1px solid rgba(0, 0, 0, 0.05)",
              borderRadius: "12px",
              fontSize: "12px",
            }}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} animationDuration={1000}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.value >= 0 ? COLORS.primary : COLORS.red} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DayPerformanceChart({ data, height = 250 }: ChartProps) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={COLORS.grid} className="dark:stroke-white/5" />
          <XAxis
            dataKey="name"
            stroke={COLORS.text}
            fontSize={10}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke={COLORS.text}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `$${value}`}
          />
          <Tooltip
            cursor={{ fill: "rgba(0, 0, 0, 0.02)" }}
            contentStyle={{
              backgroundColor: "#FFF",
              border: "1px solid rgba(0, 0, 0, 0.05)",
              borderRadius: "12px",
              fontSize: "12px",
            }}
          />
          <Bar dataKey="value" radius={[4, 4, 0, 0]} animationDuration={1000}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.value >= 0 ? COLORS.primary : COLORS.red} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

