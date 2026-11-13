import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bike,
  CheckCircle2,
  Compass,
  Navigation,
  Pause,
  Play,
  Radio,
  StepForward,
} from 'lucide-react';
import { LiveDeliveryMap } from './LiveDeliveryMap';
import type { Coordinate, Order, OrderStatus, TrafficSegment } from '../types/tracknow';

interface CourierConsoleProps {
  orders: Order[];
  selectedOrderId: string | null;
  onSelectOrder: (orderId: string) => void;
  trafficSegments: TrafficSegment[];
  viewerLocation: Coordinate | null;
  onUpdateLocation: (orderId: string, coord: Coordinate) => void;
  onStepForward: (orderId: string) => void;
  onToggleAutoDrive: (orderId: string, enabled: boolean) => void;
  onUpdateStatus: (orderId: string, status: OrderStatus) => void;
  onToggleTraffic: (segmentId: string) => void;
  onTrackOrder: (orderId: string) => void;
}

export function CourierConsole({
  orders,
  selectedOrderId,
  onSelectOrder,
  trafficSegments,
  viewerLocation,
  onUpdateLocation,
  onStepForward,
  onToggleAutoDrive,
  onUpdateStatus,
  onToggleTraffic,
  onTrackOrder,
}: CourierConsoleProps) {
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [streamingGps, setStreamingGps] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const activeOrder =
    orders.find((o) => o.id === selectedOrderId) || orders[0] || null;

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null && 'geolocation' in navigator) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  if (!activeOrder) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="max-w-md mx-auto bg-white border border-zinc-200 rounded-xl p-8">
          <h1 className="font-display text-2xl font-bold text-zinc-900">
            No courier deliveries assigned
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Place an order from the Menu to dispatch a live delivery job.
          </p>
        </div>
      </main>
    );
  }

  const handleUseDeviceGps = () => {
    if (!('geolocation' in navigator)) {
      setGeoMessage('Device geolocation is unavailable in this browser.');
      return;
    }
    setGeoMessage('Reading GPS coordinates...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        onToggleAutoDrive(activeOrder.id, false);
        onUpdateLocation(activeOrder.id, {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        });
        setGeoMessage('Live device GPS broadcasted to viewer map.');
      },
      () => {
        setGeoMessage(
          'Location permission denied. Click directly on the map to broadcast courier position.',
        );
      },
      { enableHighAccuracy: true, timeout: 6000 },
    );
  };

  const handleToggleStreamGps = () => {
    if (!('geolocation' in navigator)) {
      setGeoMessage('Device geolocation is unavailable in this browser.');
      return;
    }

    if (streamingGps && watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setStreamingGps(false);
      setGeoMessage('Stopped live GPS streaming.');
      return;
    }

    onToggleAutoDrive(activeOrder.id, false);
    setStreamingGps(true);
    setGeoMessage('Streaming live device GPS coordinates...');
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        onUpdateLocation(activeOrder.id, {
          lat: Number(pos.coords.latitude.toFixed(6)),
          lng: Number(pos.coords.longitude.toFixed(6)),
        });
        setGeoMessage(
          `Streaming live GPS (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`,
        );
      },
      () => {
        setStreamingGps(false);
        setGeoMessage(
          'Unable to stream GPS. Allow location access or click directly on the map.',
        );
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 },
    );
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="pb-6 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Delivery Boy Live GPS &amp; Traffic Control
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
            Courier Dispatch: {activeOrder.courierName}
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Click anywhere on the map or stream device GPS to move the delivery boy&apos;s
            present location, or toggle red Traffic Jam zones in real time.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {orders.slice(0, 4).map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => onSelectOrder(o.id)}
              className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-lg border cursor-pointer ${
                o.id === activeOrder.id
                  ? 'bg-zinc-900 text-white border-zinc-900'
                  : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400'
              }`}
            >
              {o.orderNumber}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Interactive Map for Courier */}
        <section className="lg:col-span-7 xl:col-span-8 bg-white border border-zinc-200 rounded-xl overflow-hidden flex flex-col min-h-[500px] lg:min-h-[600px]">
          <LiveDeliveryMap
            order={activeOrder}
            trafficSegments={trafficSegments}
            viewerLocation={viewerLocation}
            interactiveCourierMode
            onMapClick={(coord) => onUpdateLocation(activeOrder.id, coord)}
          />
        </section>

        {/* Courier Controls & Red Traffic Jam Manager */}
        <aside className="lg:col-span-5 xl:col-span-4 flex flex-col gap-5">
          <section className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bike className="w-5 h-5 text-[#D9381E]" aria-hidden="true" />
                <h2 className="font-display text-base font-semibold text-zinc-900">
                  Rider Controls
                </h2>
              </div>
              <span className="font-mono text-xs font-semibold text-zinc-600">
                {activeOrder.orderNumber}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <button
                type="button"
                onClick={() =>
                  onToggleAutoDrive(activeOrder.id, !activeOrder.autoDrive)
                }
                disabled={activeOrder.status === 'delivered'}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 font-semibold rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-900 disabled:opacity-40 cursor-pointer"
              >
                {activeOrder.autoDrive ? (
                  <>
                    <Pause className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Pause Auto-Drive</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Resume Auto-Drive</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => onStepForward(activeOrder.id)}
                disabled={activeOrder.status === 'delivered'}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 font-semibold rounded-lg border border-zinc-200 bg-zinc-50 hover:bg-zinc-100 text-zinc-900 disabled:opacity-40 cursor-pointer"
              >
                <StepForward className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Step Route</span>
              </button>

              <button
                type="button"
                onClick={handleUseDeviceGps}
                className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 font-semibold rounded-lg border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-900 cursor-pointer"
              >
                <Compass className="w-3.5 h-3.5 text-[#D9381E]" aria-hidden="true" />
                <span>Ping Current GPS</span>
              </button>

              <button
                type="button"
                onClick={handleToggleStreamGps}
                className={`inline-flex items-center justify-center gap-1.5 px-3 py-2.5 font-semibold rounded-lg border cursor-pointer ${
                  streamingGps
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-zinc-900 border-zinc-200 hover:bg-zinc-50'
                }`}
              >
                <Radio className="w-3.5 h-3.5" aria-hidden="true" />
                <span>{streamingGps ? 'Stop Live GPS' : 'Stream Live GPS'}</span>
              </button>

              <button
                type="button"
                onClick={() => onUpdateStatus(activeOrder.id, 'delivered')}
                disabled={activeOrder.status === 'delivered'}
                className="col-span-2 inline-flex items-center justify-center gap-1.5 px-3 py-2.5 font-semibold rounded-lg bg-zinc-900 hover:bg-zinc-800 text-white disabled:opacity-40 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Mark Delivered</span>
              </button>
            </div>

            {geoMessage && (
              <p className="text-xs text-zinc-600 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2">
                {geoMessage}
              </p>
            )}

            <button
              type="button"
              onClick={() => onTrackOrder(activeOrder.id)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#D9381E] hover:bg-[#B82D17] rounded-lg transition-colors cursor-pointer"
            >
              <Navigation className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Switch to Customer Track Order View</span>
            </button>
          </section>

          {/* Red Traffic Jam Reporter */}
          <section className="bg-white border border-zinc-200 rounded-xl p-5 space-y-3.5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" aria-hidden="true" />
              <h2 className="font-display text-base font-semibold text-zinc-900">
                Traffic Jam Corridor Control
              </h2>
            </div>
            <p className="text-xs text-zinc-500">
              Toggle heavy traffic jams to mark road segments in bright red on all
              live Track Order maps and recalculate delivery ETA.
            </p>

            <div className="space-y-2.5">
              {trafficSegments.map((seg) => {
                const isHeavy = seg.severity === 'heavy';
                return (
                  <div
                    key={seg.id}
                    className={`p-3 rounded-lg border flex items-center justify-between gap-3 ${
                      isHeavy
                        ? 'bg-red-50/70 border-red-200'
                        : 'bg-zinc-50 border-zinc-200'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 truncate">
                        {seg.roadName}
                      </p>
                      <p
                        className={`text-xs font-medium ${
                          isHeavy ? 'text-red-700' : 'text-zinc-500'
                        }`}
                      >
                        {isHeavy
                          ? `Heavy Traffic Jam · +${seg.delayMinutes} min`
                          : seg.severity === 'moderate'
                            ? 'Moderate Flow'
                            : 'Clear Corridor'}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => onToggleTraffic(seg.id)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-md whitespace-nowrap shrink-0 cursor-pointer ${
                        isHeavy
                          ? 'bg-white border border-red-300 text-red-700 hover:bg-red-100'
                          : 'bg-red-600 text-white hover:bg-red-700'
                      }`}
                    >
                      {isHeavy ? 'Clear Jam' : 'Mark Red Jam'}
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
