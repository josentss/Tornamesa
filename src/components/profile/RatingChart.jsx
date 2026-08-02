export default function RatingChart({ distribution }) {
  const entries = Object.entries(distribution)
    .map(([rating, count]) => [Number(rating), count])
    .sort(([a], [b]) => a - b);

  const ratings = entries.map(([r]) => r);
  const counts = entries.map(([, c]) => c);

  const minX = Math.min(...ratings, 1);
  const maxX = Math.max(...ratings, 5);
  const maxY = Math.max(...counts, 1);

  // Escala de la cuadrícula (redondeamos el máximo de Y hacia arriba a un valor “bonito”)
  const yTicks = Array.from({ length: maxY + 1 }, (_, i) => i);
  const xTicks = Array.from({ length: maxX - minX + 1 }, (_, i) => minX + i);

  const chartHeight = 160; // px
  const chartWidth = 280;  // px
  const paddingLeft = 36;
  const paddingBottom = 28;
  const paddingTop = 12;
  const paddingRight = 12;

  const plotWidth = chartWidth - paddingLeft - paddingRight;
  const plotHeight = chartHeight - paddingTop - paddingBottom;

  const xScale = (x) => paddingLeft + ((x - minX) / (maxX - minX || 1)) * plotWidth;
  const yScale = (y) => paddingTop + plotHeight - (y / maxY) * plotHeight;

  const barWidth = Math.min(28, plotWidth / (ratings.length + 1) * 0.6);

  return (
    <svg
      width={chartWidth}
      height={chartHeight}
      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      className="overflow-visible"
    >
      {/* Cuadrícula horizontal */}
      {yTicks.map((y) => (
        <line
          key={`h-${y}`}
          x1={paddingLeft}
          y1={yScale(y)}
          x2={chartWidth - paddingRight}
          y2={yScale(y)}
          stroke="#e5e5e5"
          strokeWidth={1}
        />
      ))}

      {/* Cuadrícula vertical */}
      {xTicks.map((x) => (
        <line
          key={`v-${x}`}
          x1={xScale(x)}
          y1={paddingTop}
          x2={xScale(x)}
          y2={chartHeight - paddingBottom}
          stroke="#e5e5e5"
          strokeWidth={1}
        />
      ))}

      {/* Eje Y */}
      <line
        x1={paddingLeft}
        y1={chartHeight - paddingBottom}
        x2={paddingLeft}
        y2={paddingTop - 8}
        stroke="#222"
        strokeWidth={1.5}
      />
      {/* Flecha Y */}
      <polygon
        points={`
          ${paddingLeft},${paddingTop - 10}
          ${paddingLeft - 4},${paddingTop}
          ${paddingLeft + 4},${paddingTop}
        `}
        fill="#222"
      />

      {/* Eje X */}
      <line
        x1={paddingLeft}
        y1={chartHeight - paddingBottom}
        x2={chartWidth - paddingRight + 8}
        y2={chartHeight - paddingBottom}
        stroke="#222"
        strokeWidth={1.5}
      />
      {/* Flecha X */}
      <polygon
        points={`
          ${chartWidth - paddingRight + 10},${chartHeight - paddingBottom}
          ${chartWidth - paddingRight},${chartHeight - paddingBottom - 4}
          ${chartWidth - paddingRight},${chartHeight - paddingBottom + 4}
        `}
        fill="#222"
      />

      {/* Etiquetas del eje Y */}
      {yTicks.map((y) => (
        <text
          key={`yl-${y}`}
          x={paddingLeft - 8}
          y={yScale(y) + 3}
          textAnchor="end"
          fontSize={10}
          fill="#555"
        >
          {y}
        </text>
      ))}

      {/* Etiqueta “Y” */}
      <text
        x={paddingLeft - 18}
        y={paddingTop - 2}
        fontSize={12}
        fontWeight="bold"
        fill="#222"
      >
        Y
      </text>

      {/* Etiquetas del eje X */}
      {xTicks.map((x) => (
        <text
          key={`xl-${x}`}
          x={xScale(x)}
          y={chartHeight - paddingBottom + 14}
          textAnchor="middle"
          fontSize={10}
          fill="#555"
        >
          {x}
        </text>
      ))}

      {/* Etiqueta “X” */}
      <text
        x={chartWidth - paddingRight + 4}
        y={chartHeight - paddingBottom + 18}
        fontSize={12}
        fontWeight="bold"
        fill="#222"
      >
        X
      </text>

      {/* Barras */}
      {entries.map(([rating, count]) => {
        const x = xScale(rating);
        const y = yScale(count);
        const height = yScale(0) - y;

        return (
          <g key={rating}>
            <rect
              x={x - barWidth / 2}
              y={y}
              width={barWidth}
              height={height}
              fill="#7cc7e8"
              rx={2}
            />
            {/* Valor encima de la barra */}
            <text
              x={x}
              y={y - 4}
              textAnchor="middle"
              fontSize={10}
              fill="#666"
            >
              {count}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
