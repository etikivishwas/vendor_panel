import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";

function LeadActivityChart({ data }) {
  const formattedData = data.map((item) => ({
    ...item,
    label: new Date(`${item.date}T00:00:00`).toLocaleDateString(
      "en-US",
      {
        month: "short",
        day: "numeric",
      }
    ),
  }));

  return (
    <article className="panel chart-panel">
      <div className="panel-heading">
        <h2>Lead Activity (30 Days)</h2>
        <button type="button">⋮</button>
      </div>

      <div className="chart-container">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={formattedData}>
            <defs>
              <linearGradient
                id="leadGradient"
                x1="0"
                y1="0"
                x2="0"
                y2="1"
              >
                <stop
                  offset="0%"
                  stopColor="#16334a"
                  stopOpacity={0.32}
                />
                <stop
                  offset="100%"
                  stopColor="#16334a"
                  stopOpacity={0}
                />
              </linearGradient>
            </defs>

            <XAxis dataKey="label" hide />

            <Tooltip
              formatter={(value) => [value, "Leads"]}
              labelFormatter={(label) => `Date: ${label}`}
            />

            <Area
              type="monotone"
              dataKey="leads"
              stroke="#162f43"
              strokeWidth={2.5}
              fill="url(#leadGradient)"
              dot={{
                r: 4,
                fill: "#ffffff",
                stroke: "#162f43",
                strokeWidth: 2,
              }}
              activeDot={{
                r: 5,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </article>
  );
}

export default LeadActivityChart;