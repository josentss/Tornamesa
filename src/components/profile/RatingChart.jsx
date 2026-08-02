"use client";

import { useState } from "react";

export default function RatingChart({ distribution }) {
  const ratings = Array.from({ length: 10 }, (_, i) => i + 1);
  const maxCount = Math.max(...ratings.map((r) => distribution[r] || 0), 1);
  const [hovered, setHovered] = useState(null);

  const chartHeight = 140;
  const chartWidth = 260;
  const paddingLeft = 28;
  const paddingBottom = 24;
  const paddingTop = 14;
  const paddingRight = 10;

  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;

  const xScale = (x) => paddingLeft + ((x - 1) / 9) * plotWidth;
  const yScale = (y) => paddingTop + plotHeight - (y / maxCount) * plotHeight;
  const barWidth = Math.min(18, plotWidth / 12);

  return (
    <div className="relative w-full">
      <svg
        width="100%"
        height={chartHeight}
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="overflow-visible"
        role="img"
        aria-label="Rating distribution from 1 to 10"
      >
        {Array.from({ length: maxCount + 1 }, (_, i) => (
          <line
            key={`h-${i}`}
            x1={paddingLeft}
            y1={yScale(i)}
            x2={chartWidth - paddingRight}
            y2={yScale(i)}
            stroke="#2a3645"
            strokeWidth={1}
          />
        ))}

        <line
          x1={paddingLeft}
          y1={chartHeight - paddingBottom}
          x2={paddingLeft}
          y2={paddingTop - 6}
          stroke="#7cc7e8"
          strokeWidth={1.5}
        />
        <polygon
          points={`${paddingLeft},${paddingTop - 8} ${paddingLeft - 3.5},${paddingTop} ${paddingLeft + 3.5},${paddingTop}`}
          fill="#7cc7e8"
        />
        <line
          x1={paddingLeft}
          y1={chartHeight - paddingBottom}
          x2={chartWidth - paddingRight + 6}
          y2={chartHeight - paddingBottom}
          stroke="#7cc7e8"
          strokeWidth={1.5}
        />
        <polygon
          points={`${chartWidth - paddingRight + 8},${chartHeight - paddingBottom} ${chartWidth - paddingRight},${chartHeight - paddingBottom - 3.5} ${chartWidth - paddingRight},${chartHeight - paddingBottom + 3.5}`}
          fill="#7cc7e8"
        />

        {Array.from({ length: maxCount + 1 }, (_, i) => (
          <text
            key={`yl-${i}`}
            x={paddingLeft - 6}
            y={yScale(i) + 3}
            textAnchor="end"
            fontSize={9}
            fill="#94a3b8"
          >
            {i}
          </text>
        ))}

        {ratings.map((r) => (
          <text
            key={`xl-${r}`}
            x={xScale(r)}
            y={chartHeight - paddingBottom + 14}
            textAnchor="middle"
            fontSize={9}
            fill="#94a3b8"
          >
            {r}
          </text>
        ))}

        {ratings.map((rating) => {
          const count = distribution[rating] || 0;
          if (count === 0) return null;

          const x = xScale(rating);
          const y = yScale(count);
          const height = yScale(0) - y;

          return (
            <g
              key={rating}
              onMouseEnter={() => setHovered(rating)}
              onMouseLeave={() => setHovered(null)}
              className="cursor-pointer"
            >
              <rect
                x={x - barWidth / 2}
                y={y}
                width={barWidth}
                height={height}
                fill={hovered === rating ? "#a5d8f0" : "#7cc7e8"}
                rx={2}
                className="transition-colors duration-150"
              />
              <text
                x={x}
                y={y - 4}
                textAnchor="middle"
                fontSize={9}
                fill="#cbd5e1"
              >
                {count}
              </text>
            </g>
          );
        })}
      </svg>

      {hovered !== null && (
        <div className="absolute left-1/2 -translate-x-1/2 -top-2 bg-[#0a121c] border border-[#2a3645] text-xs text-stone-200 px-3 py-1.5 rounded-lg shadow-lg pointer-events-none z-10 whitespace-nowrap">
          <span className="font-semibold text-[#7cc7e8]">{distribution[hovered] || 0}</span>{" "}
          album{(distribution[hovered] || 0) !== 1 ? "s" : ""} rated{" "}
          <span className="font-semibold">{hovered}</span>
        </div>
      )}
    </div>
  );
}
