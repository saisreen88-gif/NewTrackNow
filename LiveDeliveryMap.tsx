import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { AlertTriangle, Crosshair, LocateFixed, Maximize2 } from 'lucide-react';
import type { Coordinate, Order, TrafficSegment } from '../types/tracknow';

interface LiveDeliveryMapProps {
  order: Order;
  trafficSegments: TrafficSegment[];
  viewerLocation?: Coordinate | null;
  interactiveCourierMode?: boolean;
  onMapClick?: (coord: Coordinate) => void;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export function LiveDeliveryMap({
  order,
  trafficSegments,
  viewerLocation = null,
  interactiveCourierMode = false,
  onMapClick,
}: LiveDeliveryMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const courierMarkerRef = useRef<L.Marker | null>(null);
  const hasFittedKeyRef = useRef<string | null>(null);
  const onMapClickRef = useRef(onMapClick);
  onMapClickRef.current = onMapClick;

  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const [tilesOffline, setTilesOffline] = useState(false);
  const [mapStyle, setMapStyle] = useState<'osm' | 'esri' | 'satellite'>('osm');

  // Initialize Leaflet Map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      center: [order.courierLocation.lat, order.courierLocation.lng],
      zoom: 14,
      zoomControl: true,
    });

    // Offline / restricted-sandbox crisp urban grid fallback layer
    const FallbackGrid = L.GridLayer.extend({
      createTile(coords: L.Coords) {
        const tile = document.createElement('canvas');
        const size = this.getTileSize();
        tile.width = size.x;
        tile.height = size.y;
        const ctx = tile.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#F4F4F2';
          ctx.fillRect(0, 0, size.x, size.y);
          ctx.strokeStyle = '#E4E4E0';
          ctx.lineWidth = 1;
          for (let i = 0; i <= size.x; i += 32) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, size.y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(size.x, i);
            ctx.stroke();
          }
          ctx.strokeStyle = '#D4D4CE';
          ctx.lineWidth = 2;
          ctx.strokeRect(0, 0, size.x, size.y);
          if ((coords.x + coords.y) % 3 === 0) {
            ctx.fillStyle = '#E8EAE6';
            ctx.fillRect(36, 36, 60, 60);
          }
        }
        return tile;
      },
    });
    const fallbackLayer = new (FallbackGrid as unknown as {
      new (opts?: L.GridLayerOptions): L.GridLayer;
    })({ zIndex: 1 });
    fallbackLayer.addTo(map);

    const group = L.layerGroup().addTo(map);
    mapRef.current = map;
    layerGroupRef.current = group;

    map.on('click', (e: L.LeafletMouseEvent) => {
      if (onMapClickRef.current) {
        onMapClickRef.current({
          lat: Number(e.latlng.lat.toFixed(6)),
          lng: Number(e.latlng.lng.toFixed(6)),
        });
      }
    });

    return () => {
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
      tileLayerRef.current = null;
      courierMarkerRef.current = null;
    };
  }, []);

  // Mount / swap base tile layer cleanly when mapStyle changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const tileConfigs = {
      osm: {
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; OpenStreetMap contributors',
      },
      esri: {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        attribution: '&copy; Esri, HERE, Garmin, OpenStreetMap contributors',
      },
      satellite: {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: '&copy; Esri, Maxar, Earthstar Geographics',
      },
    };

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    const nextConfig = tileConfigs[mapStyle];
    const nextLayer = L.tileLayer(nextConfig.url, {
      attribution: nextConfig.attribution,
      maxZoom: 19,
      zIndex: 2,
    });

    let tileErrors = 0;
    nextLayer.on('tileerror', () => {
      tileErrors += 1;
      if (tileErrors === 3 && mapStyle === 'osm') {
        setMapStyle('esri');
      } else if (tileErrors >= 8) {
        setTilesOffline(true);
      }
    });

    nextLayer.addTo(map);
    tileLayerRef.current = nextLayer;
  }, [mapStyle]);

  // Sync static & dynamic layers whenever order, trafficSegments, or viewerLocation update
  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();
    courierMarkerRef.current = null;

    // 1. Traffic Jam & Congestion Corridors
    for (const seg of trafficSegments) {
      const latlngs = seg.points.map((p) => [p.lat, p.lng] as [number, number]);

      if (seg.severity === 'heavy') {
        L.polyline(latlngs, {
          color: '#FCA5A5',
          weight: 16,
          opacity: 0.55,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(group);

        const redLine = L.polyline(latlngs, {
          color: '#DC2626',
          weight: 7,
          opacity: 0.95,
          lineCap: 'round',
          lineJoin: 'round',
        }).addTo(group);

        redLine.bindPopup(
          `<div>
            <strong style="color:#B91C1C;">Traffic Jam · ${escapeHtml(seg.roadName)}</strong><br/>
            <span>${escapeHtml(seg.reason)}</span><br/>
            <span style="font-family:monospace;font-size:12px;">Estimated delay: +${seg.delayMinutes} min</span>
          </div>`,
        );

        const jamIcon = L.divIcon({
          className: 'tracknow-div-icon',
          iconSize: [130, 30],
          iconAnchor: [65, 15],
          html: `<div style="display:inline-flex;align-items:center;gap:5px;background:#DC2626;color:#FFFFFF;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 4px 10px rgba(220,38,38,0.35);border:1.5px solid #FFFFFF;">
            <span style="font-size:12px;line-height:1;">▲</span>
            <span>Traffic Jam · +${seg.delayMinutes}m</span>
          </div>`,
        });

        L.marker([seg.incidentPoint.lat, seg.incidentPoint.lng], {
          icon: jamIcon,
          zIndexOffset: 300,
        })
          .bindPopup(
            `<div>
              <strong style="color:#B91C1C;">Heavy Traffic Jam</strong><br/>
              <span>${escapeHtml(seg.roadName)}</span><br/>
              <span style="color:#52525B;">${escapeHtml(seg.reason)}</span>
            </div>`,
          )
          .addTo(group);
      } else if (seg.severity === 'moderate') {
        L.polyline(latlngs, {
          color: '#D97706',
          weight: 5,
          opacity: 0.75,
          dashArray: '6 6',
        })
          .bindPopup(
            `<strong>Moderate Traffic · ${escapeHtml(seg.roadName)}</strong><br/>${escapeHtml(seg.reason)}`,
          )
          .addTo(group);
      }
    }

    // 2. Delivery Route (completed vs remaining)
    const waypoints = order.routeWaypoints.map(
      (p) => [p.lat, p.lng] as [number, number],
    );
    if (waypoints.length > 1) {
      const splitIdx = Math.min(
        waypoints.length - 1,
        Math.max(0, order.routeProgressIndex),
      );
      const completed = waypoints.slice(0, splitIdx + 1);
      const remaining = waypoints.slice(splitIdx);

      if (remaining.length > 1) {
        L.polyline(remaining, {
          color: '#2563EB',
          weight: 4,
          opacity: 0.85,
          dashArray: '8 8',
        }).addTo(group);
      }
      if (completed.length > 1) {
        L.polyline(completed, {
          color: '#18181B',
          weight: 4,
          opacity: 0.85,
        }).addTo(group);
      }
    }

    // 3. Restaurant Pin
    const restaurantIcon = L.divIcon({
      className: 'tracknow-div-icon',
      iconSize: [160, 44],
      iconAnchor: [80, 40],
      html: `<div style="display:flex;flex-direction:column;align-items:center;">
        <div style="background:#18181B;color:#FFFFFF;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:600;white-space:nowrap;box-shadow:0 3px 8px rgba(0,0,0,0.22);border:1.5px solid #FFFFFF;">
          Kitchen · ${escapeHtml(order.restaurantName)}
        </div>
        <div style="width:10px;height:10px;background:#18181B;border:2px solid #FFFFFF;border-radius:9999px;margin-top:2px;"></div>
      </div>`,
    });

    L.marker([order.restaurantLocation.lat, order.restaurantLocation.lng], {
      icon: restaurantIcon,
      zIndexOffset: 200,
    })
      .bindPopup(
        `<strong>${escapeHtml(order.restaurantName)}</strong><br/>${escapeHtml(order.restaurantAddress)}`,
      )
      .addTo(group);

    // 4. Customer Delivery Destination Pin
    const destIcon = L.divIcon({
      className: 'tracknow-div-icon',
      iconSize: [140, 44],
      iconAnchor: [70, 40],
      html: `<div style="display:flex;flex-direction:column;align-items:center;">
        <div style="background:#0F766E;color:#FFFFFF;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:600;white-space:nowrap;box-shadow:0 3px 8px rgba(0,0,0,0.22);border:1.5px solid #FFFFFF;">
          Drop-off · ${escapeHtml(order.customerName)}
        </div>
        <div style="width:10px;height:10px;background:#0F766E;border:2px solid #FFFFFF;border-radius:9999px;margin-top:2px;"></div>
      </div>`,
    });

    L.marker([order.deliveryLocation.lat, order.deliveryLocation.lng], {
      icon: destIcon,
      zIndexOffset: 200,
    })
      .bindPopup(
        `<strong>Delivery Destination</strong><br/>${escapeHtml(order.deliveryAddress)}`,
      )
      .addTo(group);

    // 4b. Viewer's Own Current Browser Location Marker (blue GPS pin)
    if (viewerLocation) {
      const meIcon = L.divIcon({
        className: 'tracknow-div-icon',
        iconSize: [150, 42],
        iconAnchor: [75, 36],
        html: `<div style="display:flex;flex-direction:column;align-items:center;">
          <div style="background:#2563EB;color:#FFFFFF;padding:3px 8px;border-radius:6px;font-size:11px;font-weight:700;white-space:nowrap;box-shadow:0 3px 10px rgba(37,99,235,0.35);border:1.5px solid #FFFFFF;">
            You · Current GPS
          </div>
          <div style="width:14px;height:14px;background:#2563EB;border:2.5px solid #FFFFFF;border-radius:9999px;margin-top:3px;box-shadow:0 0 0 5px rgba(37,99,235,0.22);"></div>
        </div>`,
      });

      L.marker([viewerLocation.lat, viewerLocation.lng], {
        icon: meIcon,
        zIndexOffset: 350,
      })
        .bindPopup(
          `<strong>Your Current Location</strong><br/><span style="font-family:monospace;font-size:12px;">${viewerLocation.lat.toFixed(5)}, ${viewerLocation.lng.toFixed(5)}</span>`,
        )
        .addTo(group);
    }

    // 5. Real-Time Delivery Boy (Courier) Marker
    const jamRing = order.inTrafficJam
      ? 'box-shadow:0 0 0 6px rgba(220,38,38,0.28), 0 6px 14px rgba(0,0,0,0.3);'
      : 'box-shadow:0 0 0 5px rgba(217,56,30,0.22), 0 6px 14px rgba(0,0,0,0.3);';

    const courierBadgeColor = order.inTrafficJam ? '#DC2626' : '#D9381E';
    const courierLabel =
      order.status === 'delivered'
        ? `${order.courierName} · Delivered`
        : order.inTrafficJam
          ? `${order.courierName} · In Traffic Jam (${order.courierSpeedKmh} km/h)`
          : `${order.courierName} · ${order.courierSpeedKmh} km/h`;

    const courierIcon = L.divIcon({
      className: 'tracknow-div-icon',
      iconSize: [210, 52],
      iconAnchor: [105, 42],
      html: `<div style="display:flex;flex-direction:column;align-items:center;">
        <div style="background:${courierBadgeColor};color:#FFFFFF;padding:4px 9px;border-radius:6px;font-size:11px;font-weight:700;white-space:nowrap;border:1.5px solid #FFFFFF;${jamRing}">
          ${escapeHtml(courierLabel)}
        </div>
        <div style="width:16px;height:16px;background:${courierBadgeColor};border:2.5px solid #FFFFFF;border-radius:9999px;margin-top:3px;"></div>
      </div>`,
    });

    const courierMarker = L.marker(
      [order.courierLocation.lat, order.courierLocation.lng],
      {
        icon: courierIcon,
        zIndexOffset: 500,
      },
    )
      .bindPopup(
        `<div>
          <strong>Courier: ${escapeHtml(order.courierName)}</strong><br/>
          <span>${escapeHtml(order.courierVehicle)}</span><br/>
          <span style="font-family:monospace;font-size:12px;">GPS: ${order.courierLocation.lat.toFixed(5)}, ${order.courierLocation.lng.toFixed(5)}</span><br/>
          <span>Speed: ${order.courierSpeedKmh} km/h</span>
        </div>`,
      )
      .addTo(group);

    courierMarkerRef.current = courierMarker;

    // Fit map bounds when order ID or destination coordinates change
    const fitKey = `${order.id}:${order.deliveryLocation.lat.toFixed(4)},${order.deliveryLocation.lng.toFixed(4)}`;
    if (hasFittedKeyRef.current !== fitKey) {
      const boundsPoints: Array<[number, number]> = [
        [order.restaurantLocation.lat, order.restaurantLocation.lng],
        [order.deliveryLocation.lat, order.deliveryLocation.lng],
        [order.courierLocation.lat, order.courierLocation.lng],
      ];
      for (const seg of trafficSegments) {
        if (seg.severity === 'heavy') {
          boundsPoints.push([seg.incidentPoint.lat, seg.incidentPoint.lng]);
        }
      }
      const bounds = L.latLngBounds(boundsPoints);
      map.fitBounds(bounds, { padding: [55, 55], maxZoom: 15 });
      hasFittedKeyRef.current = fitKey;
    }
  }, [order, trafficSegments, viewerLocation]);

  const handleCenterOnCourier = () => {
    mapRef.current?.setView(
      [order.courierLocation.lat, order.courierLocation.lng],
      15,
      { animate: true },
    );
  };

  const handleCenterOnMe = () => {
    if (!viewerLocation) return;
    mapRef.current?.setView([viewerLocation.lat, viewerLocation.lng], 15, {
      animate: true,
    });
  };

  const handleFitRoute = () => {
    if (!mapRef.current) return;
    const bounds = L.latLngBounds([
      [order.restaurantLocation.lat, order.restaurantLocation.lng],
      [order.deliveryLocation.lat, order.deliveryLocation.lng],
      [order.courierLocation.lat, order.courierLocation.lng],
    ]);
    mapRef.current.fitBounds(bounds, { padding: [55, 55], maxZoom: 15 });
  };

  const heavyCount = trafficSegments.filter((s) => s.severity === 'heavy').length;

  return (
    <div className="relative w-full h-full flex flex-col">
      <div
        ref={containerRef}
        className={`w-full flex-1 min-h-[420px] ${
          interactiveCourierMode ? 'cursor-crosshair' : ''
        }`}
        aria-label="Live delivery tracking map showing restaurant, courier location, and red traffic jam zones"
      />

      {/* Top-right Map Controls */}
      <div className="absolute top-3 right-3 z-20 flex flex-col items-end gap-2">
        <div
          role="group"
          aria-label="Map style"
          className="inline-flex items-center p-0.5 bg-white/95 border border-zinc-200 rounded-lg shadow-sm"
        >
          {(
            [
              { id: 'osm', label: 'Street' },
              { id: 'esri', label: 'Esri Road' },
              { id: 'satellite', label: 'Satellite' },
            ] as const
          ).map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setMapStyle(mode.id)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                mapStyle === mode.id
                  ? 'bg-zinc-900 text-white'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleCenterOnCourier}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/95 hover:bg-white border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-900 shadow-sm transition-colors cursor-pointer"
        >
          <Crosshair className="w-3.5 h-3.5 text-[#D9381E]" aria-hidden="true" />
          <span>Center on Rider</span>
        </button>
        {viewerLocation && (
          <button
            type="button"
            onClick={handleCenterOnMe}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/95 hover:bg-white border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-900 shadow-sm transition-colors cursor-pointer"
          >
            <LocateFixed className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
            <span>Center on Me</span>
          </button>
        )}
        <button
          type="button"
          onClick={handleFitRoute}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/95 hover:bg-white border border-zinc-200 rounded-lg text-xs font-semibold text-zinc-900 shadow-sm transition-colors cursor-pointer"
        >
          <Maximize2 className="w-3.5 h-3.5 text-zinc-600" aria-hidden="true" />
          <span>Fit Full Route</span>
        </button>
      </div>

      {/* Interactive Courier Hint */}
      {interactiveCourierMode && (
        <div className="absolute top-3 left-14 z-20 bg-zinc-900/90 text-white px-3 py-1.5 rounded-lg text-xs font-medium shadow-sm">
          Click anywhere on map to broadcast courier GPS location
        </div>
      )}

      {/* Map Legend Footer */}
      <div className="bg-white border-t border-zinc-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs text-zinc-600">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
          <div className="inline-flex items-center gap-1.5 font-medium text-red-700">
            <span
              className="inline-block w-4 h-1.5 bg-red-600 rounded-xs"
              aria-hidden="true"
            />
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" aria-hidden="true" />
            <span>
              Red Mark = Traffic Jam ({heavyCount}{' '}
              {heavyCount === 1 ? 'zone' : 'zones'})
            </span>
          </div>

          <div className="inline-flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full bg-[#D9381E]"
              aria-hidden="true"
            />
            <span>Delivery Boy (Live)</span>
          </div>

          <div className="inline-flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full bg-zinc-900"
              aria-hidden="true"
            />
            <span>Restaurant</span>
          </div>

          <div className="inline-flex items-center gap-1.5">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full bg-teal-700"
              aria-hidden="true"
            />
            <span>Drop-off</span>
          </div>

          {viewerLocation && (
            <div className="inline-flex items-center gap-1.5">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full bg-blue-600"
                aria-hidden="true"
              />
              <span>Your Location</span>
            </div>
          )}
        </div>

        <span className="font-mono text-zinc-500">
          {tilesOffline ? 'Street Grid Mode · ' : ''}
          GPS {order.courierLocation.lat.toFixed(4)},{' '}
          {order.courierLocation.lng.toFixed(4)}
        </span>
      </div>
    </div>
  );
}
