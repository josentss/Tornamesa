"use client";

import { useState, useMemo } from "react";

function buildYTicks(maxCount) {
  if (maxCount <= 0) return [0, 1];
  if (maxCount <= 5) {
    return Array.from({ length: maxCount + 1 }, (_, i) => i);
  }
  const target = 4;
  let step = Math.ceil(maxCount / target);
  if (step > 5 && step % 5 !== 0) step = Math.ceil(step / 5) * 5;
  else if (step > 2 && step % 2 !== 0) step = Math.ceil(step / 2) * 2;

  const ticks = [0];
  for (let v = step; v < maxCount; v += step) ticks.push(v);
  if (ticks[ticks.length - 1] !== maxCount) ticks.push(maxCount);
  return ticks;
}

export default function RatingChart({ distribution }) {
  const ratings = Array.from({ length: 10 }, (_, i) => i + 1);
  const maxCount = Math.max(...ratings.map((r) => distribution[r] || 0), 1);
  const yTicks = useMemo(() => buildYTicks(maxCount), [maxCount]);
  const [hovered, setHovered] = useState(null);

  const chartHeight = 156;
  const chartWidth = 280;
  const paddingLeft = 26;
  const paddingBottom = 26;
  const paddingTop = 18;
  const paddingRight = 12;

  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;

  const xScale = (x) => paddingLeft + ((x - 1) / 9) * plotWidth;
  const yScale = (y) =>
    paddingTop + plotHeight - (y / maxCount) * plotHeight;
  const barWidth = Math.min(16, plotWidth / 11);

  const totalRated = ratings.reduce(
    (s, r) => s + (distribution[r] || 0),
    0
  );

  if (totalRated === 0) {
    return (
      <p className="text-xs text-stone-500 text-center py-6">
        No ratings yet
      </p>
    );
  }

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
        {/* Horizontal grid — only at nice ticks */}
        {yTicks.map((t) => (
          <line
            key={`h-${t}`}
            x1={paddingLeft}
            y1={yScale(t)}
            x2={chartWidth - paddingRight}
            y2={yScale(t)}
            stroke="#2a3645"
            strokeWidth={1}
          />
        ))}

        {/* Axes */}
        <line
          x1={paddingLeft}
          y1={chartHeight - paddingBottom}
          x2={paddingLeft}
          y2={paddingTop - 4}
          stroke="#3d5068"
          strokeWidth={1.25}
        />
        <line
          x1={paddingLeft}
          y1={chartHeight - paddingBottom}
          x2={chartWidth - paddingRight + 4}
          y2={chartHeight - paddingBottom}
          stroke="#3d5068"
          strokeWidth={1.25}
        />

        {/* Y labels — sparse */}
        {yTicks.map((t) => (
          <text
            key={`yl-${t}`}
            x={paddingLeft - 6}
            y={yScale(t) + 3}
            textAnchor="end"
            fontSize={9}
            fill="#64748b"
          >
            {t}
          </text>
        ))}

        {/* X labels 1–10 */}
        {ratings.map((r) => (
          <text
            key={`xl-${r}`}
            x={xScale(r)}
            y={chartHeight - paddingBottom + 14}
            textAnchor="middle"
            fontSize={9}
            fill="#64748b"
          >
            {r}
          </text>
        ))}

        {/* Bars — all scores, empty slots stay subtle */}
        {ratings.map((rating) => {
          const count = distribution[rating] || 0;
          const x = xScale(rating);
          const y = count > 0 ? yScale(count) : yScale(0);
          const height = count > 0 ? Math.max(2, yScale(0) - y) : 0;
          const isHot = hovered === rating;

          return (
            <g
              key={rating}
              onMouseEnter={() => setHovered(rating)}
              onMouseLeave={() => setHovered(null)}
              className="cursor-pointer"
            >
              {/* Hit area */}
              <rect
                x={x - barWidth / 2 - 2}
                y={paddingTop}
                width={barWidth + 4}
                height={plotHeight}
                fill="transparent"
              />
              {count > 0 && (
                <rect
                  x={x - barWidth / 2}
                  y={y}
                  width={barWidth}
                  height={height}
                  fill={isHot ? "#a5d8f0" : "#7cc7e8"}
                  rx={3}
                  className="transition-colors duration-150"
                />
              )}
              {/* Count only when hovered or bar is tall enough */}
              {count > 0 && (isHot || height > 18) && (
                <text
                  x={x}
                  y={y - 5}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={600}
                  fill={isHot ? "#e2e8f0" : "#94a3b8"}
                >
                  {count}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {hovered !== null && (
        <div className="absolute left-1/2 -translate-x-1/2 top-0 bg-[#0a121c] border border-[#2a3645] text-xs text-stone-200 px-3 py-1.5 rounded-lg shadow-lg pointer-events-none z-10 whitespace-nowrap">
          <span className="font-semibold text-[#7cc7e8]">
            {distribution[hovered] || 0}
          </span>{" "}
          album{(distribution[hovered] || 0) !== 1 ? "s" : ""} rated{" "}
          <span className="font-semibold">{hovered}</span>
        </div>
      )}
    </div>
  );
}
