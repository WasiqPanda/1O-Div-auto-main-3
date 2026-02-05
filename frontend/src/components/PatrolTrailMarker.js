import React from 'react';
import { CircleMarker, Tooltip } from 'react-leaflet';

export const PatrolTrailMarker = ({ position, type, patrolName, time }) => {
  const config = {
    start: {
      color: '#22c55e',
      fillColor: '#22c55e',
      label: 'START'
    },
    end: {
      color: '#0ea5e9',
      fillColor: '#0ea5e9',
      label: 'END'
    }
  };

  const style = config[type] || config.start;

  return (
    <CircleMarker
      center={position}
      radius={8}
      pathOptions={{
        color: style.color,
        fillColor: style.fillColor,
        fillOpacity: 1,
        weight: 3
      }}
    >
      <Tooltip permanent direction="top" offset={[0, -10]}>
        <div className="text-xs font-bold">
          {style.label}
        </div>
      </Tooltip>
    </CircleMarker>
  );
};
