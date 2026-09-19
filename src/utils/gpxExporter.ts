import { LiveGpsPoint, RideAnalysis } from '../types';

export function exportAnalysisToGPX(analysis: RideAnalysis): string {
  const timestamp = new Date().toISOString();
  let gpx = `<?xml version="1.0" encoding="UTF-8" ?>\n`;
  gpx += `<gpx version="1.1" creator="Kinetic MotoGPX Analyzer" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v2" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">\n`;
  gpx += `  <metadata>\n`;
  gpx += `    <name>${escapeXml(analysis.name)}</name>\n`;
  gpx += `    <time>${timestamp}</time>\n`;
  gpx += `  </metadata>\n`;

  if (analysis.pitStops && analysis.pitStops.length > 0) {
    analysis.pitStops.forEach(wpt => {
      gpx += `  <wpt lat="${wpt.lat.toFixed(7)}" lon="${wpt.lon.toFixed(7)}">\n`;
      if (wpt.ele !== null && wpt.ele !== undefined) {
        gpx += `    <ele>${wpt.ele.toFixed(1)}</ele>\n`;
      }
      gpx += `    <name>${escapeXml(wpt.name)}</name>\n`;
      gpx += `  </wpt>\n`;
    });
  }

  gpx += `  <trk>\n`;
  gpx += `    <name>${escapeXml(analysis.name)}</name>\n`;

  analysis.segments.forEach(seg => {
    gpx += `    <trkseg>\n`;
    seg.points.forEach(pt => {
      gpx += `      <trkpt lat="${pt.lat.toFixed(7)}" lon="${pt.lon.toFixed(7)}">\n`;
      if (pt.ele !== null) {
        gpx += `        <ele>${pt.ele.toFixed(2)}</ele>\n`;
      }
      if (pt.time) {
        gpx += `        <time>${pt.time}</time>\n`;
      }
      if (pt.speed !== null || pt.bearing !== null) {
        gpx += `        <extensions>\n`;
        gpx += `          <gpxtpx:TrackPointExtension>\n`;
        if (pt.speed !== null) {
          gpx += `            <gpxtpx:speed>${pt.speed.toFixed(2)}</gpxtpx:speed>\n`;
        }
        if (pt.bearing !== null) {
          gpx += `            <gpxtpx:bearing>${pt.bearing.toFixed(1)}</gpxtpx:bearing>\n`;
        }
        gpx += `          </gpxtpx:TrackPointExtension>\n`;
        gpx += `        </extensions>\n`;
      }
      gpx += `      </trkpt>\n`;
    });
    gpx += `    </trkseg>\n`;
  });

  gpx += `  </trk>\n`;
  gpx += `</gpx>\n`;
  return gpx;
}

export function exportPointsToGPX(
  trackName: string,
  points: LiveGpsPoint[],
  pitStops?: Array<{ name: string; lat: number; lon: number; ele?: number | null }>
): string {
  const timestamp = new Date().toISOString();
  let gpx = `<?xml version="1.0" encoding="UTF-8" ?>\n`;
  gpx += `<gpx version="1.1" creator="Kinetic MotoGPX Logger" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v2" xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd http://www.garmin.com/xmlschemas/TrackPointExtension/v2 https://www8.garmin.com/xmlschemas/TrackPointExtensionv2.xsd">\n`;
  gpx += `  <metadata>\n`;
  gpx += `    <name>${escapeXml(trackName)}</name>\n`;
  gpx += `    <time>${timestamp}</time>\n`;
  gpx += `  </metadata>\n`;

  if (pitStops && pitStops.length > 0) {
    pitStops.forEach(wpt => {
      gpx += `  <wpt lat="${wpt.lat.toFixed(7)}" lon="${wpt.lon.toFixed(7)}">\n`;
      if (wpt.ele !== null && wpt.ele !== undefined) {
        gpx += `    <ele>${wpt.ele.toFixed(1)}</ele>\n`;
      }
      gpx += `    <name>${escapeXml(wpt.name)}</name>\n`;
      gpx += `  </wpt>\n`;
    });
  }

  gpx += `  <trk>\n`;
  gpx += `    <name>${escapeXml(trackName)}</name>\n`;
  gpx += `    <trkseg>\n`;

  points.forEach(pt => {
    const isoTime = new Date(pt.timestamp).toISOString();
    gpx += `      <trkpt lat="${pt.lat.toFixed(7)}" lon="${pt.lon.toFixed(7)}">\n`;
    if (pt.altitude !== null) {
      gpx += `        <ele>${pt.altitude.toFixed(2)}</ele>\n`;
    }
    gpx += `        <time>${isoTime}</time>\n`;
    gpx += `        <src>gps</src>\n`;
    gpx += `        <extensions>\n`;
    gpx += `          <gpxtpx:TrackPointExtension>\n`;
    if (pt.speed !== null) {
      gpx += `            <gpxtpx:speed>${pt.speed.toFixed(2)}</gpxtpx:speed>\n`;
    }
    if (pt.heading !== null) {
      gpx += `            <gpxtpx:bearing>${pt.heading.toFixed(1)}</gpxtpx:bearing>\n`;
    }
    gpx += `          </gpxtpx:TrackPointExtension>\n`;
    gpx += `        </extensions>\n`;
    gpx += `      </trkpt>\n`;
  });

  gpx += `    </trkseg>\n`;
  gpx += `  </trk>\n`;
  gpx += `</gpx>\n`;

  return gpx;
}

function escapeXml(unsafe: string): string {
  return unsafe.replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
      default: return c;
    }
  });
}

export function downloadFile(content: string, filename: string, mimeType: string = 'application/gpx+xml') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
