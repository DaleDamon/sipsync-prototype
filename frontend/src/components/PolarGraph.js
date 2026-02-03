import React from 'react';
import '../styles/PolarGraph.css';

function PolarGraph({ preferences, profileName }) {
  // Map preference values to numeric scales (0-100)
  const mapValue = (value) => {
    const valueMap = {
      'low': 20,
      'medium-low': 35,
      'medium': 50,
      'medium-high': 65,
      'high': 80,
      'full': 80,
      'light': 30,
      'dry': 20,
      'sweet': 80,
    };
    return valueMap[value] || 50;
  };

  // Get wine type color
  const getWineTypeColor = (wineType) => {
    const colors = {
      'red': '#8b0000',
      'white': '#4169e1',
      'sparkling': '#d4a500',
      'dessert': '#d4a574',
    };
    return colors[wineType] || '#8b0000';
  };

  // Extract numeric values for each dimension
  const dimensions = [
    { name: 'Acidity', value: mapValue(preferences.acidity || 'medium') },
    { name: 'Tannins', value: mapValue(preferences.tannins || 'medium') },
    { name: 'Body', value: mapValue(preferences.bodyWeight || 'medium') },
    { name: 'Sweetness', value: mapValue(preferences.sweetness || 'dry') },
    { name: 'Flavor Intensity', value: 65 }, // Default flavor intensity
  ];

  const radius = 120;
  const center = 280; // Center positioned to prevent label cutoff on left side
  const maxValue = 100;
  const numDimensions = dimensions.length;
  const svgSize = 600; // Larger SVG to accommodate all labels

  // Calculate angle for each dimension
  const angleSlice = (Math.PI * 2) / numDimensions;

  // Function to convert polar coordinates to cartesian
  const polarToCartesian = (angle, distance) => {
    return {
      x: center + distance * Math.cos(angle - Math.PI / 2),
      y: center + distance * Math.sin(angle - Math.PI / 2),
    };
  };

  // Generate points for the polygon (user profile)
  const points = dimensions.map((dim, i) => {
    const angle = angleSlice * i;
    const distance = (dim.value / maxValue) * radius;
    return polarToCartesian(angle, distance);
  });

  const polygonPoints = points.map(p => `${p.x},${p.y}`).join(' ');

  // Generate points for the reference line (average = 50)
  const referencePoints = dimensions.map((dim, i) => {
    const angle = angleSlice * i;
    const distance = (50 / maxValue) * radius; // Fixed at 50 (average)
    return polarToCartesian(angle, distance);
  });

  const referencePolygonPoints = referencePoints.map(p => `${p.x},${p.y}`).join(' ');

  // Generate grid circles
  const gridCircles = [25, 50, 75, 100].map((value) => {
    const distance = (value / maxValue) * radius;
    return distance;
  });

  // Generate axis lines and labels
  const axisLines = dimensions.map((dim, i) => {
    const angle = angleSlice * i;
    const p = polarToCartesian(angle, radius);
    return { angle, p, dim };
  });

  const wineColor = getWineTypeColor(preferences.wineType);

  return (
    <div className="polar-graph-container">
      <div className="polar-graph-header">
        <h4>Your Wine Preference Profile</h4>
        {profileName && <p className="profile-name">{profileName}</p>}
      </div>

      <svg width={svgSize} height={svgSize} className="polar-graph-svg">
        {/* Grid circles */}
        {gridCircles.map((r, i) => (
          <circle
            key={`grid-${i}`}
            cx={center}
            cy={center}
            r={r}
            className="grid-circle"
            fill="none"
            stroke="#e0e0e0"
            strokeWidth="1"
            strokeDasharray="2,2"
          />
        ))}

        {/* Axis lines */}
        {axisLines.map((axis, i) => (
          <line
            key={`axis-${i}`}
            x1={center}
            y1={center}
            x2={axis.p.x}
            y2={axis.p.y}
            className="axis-line"
            stroke="#d0d0d0"
            strokeWidth="1"
          />
        ))}

        {/* Reference polygon (average) */}
        <polygon
          points={referencePolygonPoints}
          className="reference-polygon"
          fill="none"
          stroke="#cccccc"
          strokeWidth="1.5"
          strokeDasharray="4,3"
        />

        {/* User profile polygon */}
        <polygon
          points={polygonPoints}
          className="profile-polygon"
          fill={wineColor}
          fillOpacity="0.3"
          stroke={wineColor}
          strokeWidth="2.5"
        />

        {/* Axis labels */}
        {axisLines.map((axis, i) => {
          const labelDistance = radius + 50; // Increased from 30 to give more space for longer labels
          const labelPos = polarToCartesian(axis.angle, labelDistance);
          return (
            <text
              key={`label-${i}`}
              x={labelPos.x}
              y={labelPos.y}
              className="axis-label"
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize="13"
              fill="#333"
              fontWeight="500"
            >
              {axis.dim.name}
            </text>
          );
        })}

        {/* Data points */}
        {points.map((p, i) => (
          <circle
            key={`point-${i}`}
            cx={p.x}
            cy={p.y}
            r="4"
            fill={wineColor}
            stroke="white"
            strokeWidth="2"
          />
        ))}
      </svg>

      <div className="graph-legend">
        <div className="legend-item">
          <div className="legend-box" style={{ backgroundColor: wineColor, opacity: 0.3 }}>
          </div>
          <span>Your Profile</span>
        </div>
        <div className="legend-item">
          <div className="legend-line"></div>
          <span>Average (baseline)</span>
        </div>
      </div>

      <div className="graph-interpretation">
        <h5>Your Preferences</h5>
        <ul>
          {dimensions.map((dim, i) => (
            <li key={i}>
              <strong>{dim.name}:</strong> {dim.value}/100
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default PolarGraph;
