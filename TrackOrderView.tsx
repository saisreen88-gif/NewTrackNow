import {
  AlertTriangle,
  Bike,
  CheckCircle2,
  ChefHat,
  Clock,
  LocateFixed,
  MapPin,
  Phone,
  Store,
} from 'lucide-react';
import { LiveDeliveryMap } from './LiveDeliveryMap';
import type {
  AppView,
  Coordinate,
  Order,
  OrderStatus,
  TrafficSegment,
} from '../types/tracknow';

interface TrackOrderViewProps {
  orders: Order[];
  selectedOrderId: string | null;
  onSelectOrder: (orderId: string) => void;
  trafficSegments: TrafficSegment[];
  connected: boolean;
  viewerLocation: Coordinate | null;
  locating: boolean;
  locationError: string | null;
  onUseCurrentLocationForOrder: (orderId: string) => void;
  onNavigate: (view: AppView) => void;
}

const STATUS_STAGE_INDEX: Record<OrderStatus, number> = {
  placed: 0,
  accepted: 1,
  preparing: 1,
  ready: 1,
  picked_up: 2,
  en_route: 2,
  arriving: 2,
  delivered: 3,
};

const STATUS_DISPLAY: Record<OrderStatus, string> = {
  placed: 'Order Placed',
  accepted: 'Confirmed by Kitchen',
  preparing: 'Preparing Your Food',
  ready: 'Ready for Courier Pickup',
  picked_up: 'Picked Up by Delivery Boy',
  en_route: 'On the Way to You',
  arriving: 'Arriving Now',
  delivered: 'Delivered',
};

export function TrackOrderView({
  orders,
  selectedOrderId,
  onSelectOrder,
  trafficSegments,
  connected,
  viewerLocation,
  locating,
  locationError,
  onUseCurrentLocationForOrder,
  onNavigate,
}: TrackOrderViewProps) {
  const activeOrder =
    orders.find((o) => o.id === selectedOrderId) || orders[0] || null;

  if (!activeOrder) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <div className="max-w-md mx-auto bg-white border border-zinc-200 rounded-xl p-8">
          <h1 className="font-display text-2xl font-bold text-zinc-900">
            No active orders yet
          </h1>
          <p className="mt-2 text-sm text-zinc-600">
            Add dishes from the TrackNow menu and place an order to watch your kitchen
            and delivery rider connect in real time.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('menu')}
            className="mt-6 px-5 py-2.5 text-sm font-semibold text-white bg-[#D9381E] hover:bg-[#B82D17] rounded-lg transition-colors cursor-pointer"
          >
            Order from Menu
          </button>
        </div>
      </main>
    );
  }

  const stageIndex = STATUS_STAGE_INDEX[activeOrder.status];
  const heavyJams = trafficSegments.filter((s) => s.severity === 'heavy');

  const stages = [
    {
      title: 'Order Placed',
      detail: `${activeOrder.items.reduce((s, i) => s + i.quantity, 0)} items submitted`,
      icon: Clock,
    },
    {
      title: 'Restaurant Kitchen',
      detail:
        stageIndex < 1
          ? 'Waiting for kitchen'
          : stageIndex === 1
            ? STATUS_DISPLAY[activeOrder.status]
            : `Prepared at ${activeOrder.restaurantName}`,
      icon: ChefHat,
    },
    {
      title: 'Delivery Boy Live',
      detail:
        stageIndex < 2
          ? 'Courier assigned & waiting'
          : stageIndex === 2
            ? `${activeOrder.courierName} · ${activeOrder.courierSpeedKmh} km/h`
            : `Completed by ${activeOrder.courierName}`,
      icon: Bike,
    },
    {
      title: 'Delivered',
      detail:
        stageIndex === 3
          ? `Arrived at ${activeOrder.deliveryAddress}`
          : `ETA ${activeOrder.etaMinutes} min`,
      icon: CheckCircle2,
    },
  ];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Top Bar: Order Switcher & Connection */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200">
        <div>
          <div className="flex items-center gap-2.5 text-xs text-zinc-500">
            <span className="font-mono font-semibold text-zinc-900">
              {activeOrder.orderNumber}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {connected ? 'Live WebSocket Connected' : 'Reconnecting live feed...'}
            </span>
            <span aria-hidden="true">·</span>
            <span>{STATUS_DISPLAY[activeOrder.status]}</span>
          </div>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
            Live Order &amp; Courier Map
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onUseCurrentLocationForOrder(activeOrder.id)}
            disabled={locating || activeOrder.status === 'delivered'}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-900 bg-white border border-zinc-300 hover:border-zinc-900 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            <LocateFixed className="w-3.5 h-3.5 text-blue-600" aria-hidden="true" />
            <span>{locating ? 'Locating...' : 'Use My Current Location'}</span>
          </button>

          {orders.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto">
              {orders.slice(0, 4).map((o) => {
                const selected = o.id === activeOrder.id;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => onSelectOrder(o.id)}
                    className={`px-3 py-1.5 text-xs font-mono font-semibold rounded-lg border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      selected
                        ? 'bg-zinc-900 text-white border-zinc-900'
                        : 'bg-white text-zinc-700 border-zinc-200 hover:border-zinc-400'
                    }`}
                  >
                    {o.orderNumber}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {locationError && (
        <div className="mt-4 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
          {locationError}
        </div>
      )}

      {/* Main 2-Column Tracking Workspace */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Real-Time Map with Red Traffic Jams */}
        <section
          aria-label="Live delivery map"
          className="lg:col-span-7 xl:col-span-8 bg-white border border-zinc-200 rounded-xl overflow-hidden flex flex-col min-h-[520px] lg:min-h-[640px]"
        >
          <div className="px-5 py-3.5 border-b border-zinc-200 flex flex-wrap items-center justify-between gap-3 bg-white">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-zinc-900">
                {activeOrder.status === 'delivered'
                  ? 'Delivered'
                  : `Arriving in ${activeOrder.etaMinutes} min`}
              </span>
              <span aria-hidden="true" className="text-zinc-300">
                ·
              </span>
              <span className="text-xs text-zinc-600">
                Present Speed:{' '}
                <strong className="font-mono text-zinc-900">
                  {activeOrder.courierSpeedKmh} km/h
                </strong>
              </span>
            </div>

            {activeOrder.inTrafficJam ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2.5 py-1 rounded-md">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600" aria-hidden="true" />
                <span>Heavy Traffic Jam Ahead</span>
              </span>
            ) : (
              <span className="text-xs font-medium text-zinc-600">
                {heavyJams.length} red traffic {heavyJams.length === 1 ? 'jam' : 'jams'} on city grid
              </span>
            )}
          </div>

          <div className="flex-1 flex flex-col">
            <LiveDeliveryMap
              order={activeOrder}
              trafficSegments={trafficSegments}
              viewerLocation={viewerLocation}
            />
          </div>
        </section>

        {/* Right: Restaurant + Delivery Boy Connection Sidebar */}
        <aside className="lg:col-span-5 xl:col-span-4 flex flex-col gap-5">
          {/* Traffic Jam Warning Callout */}
          {(activeOrder.activeTrafficAlert || heavyJams.length > 0) && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle
                  className="w-5 h-5 text-red-600 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div className="text-sm">
                  <p className="font-semibold text-red-900">
                    {activeOrder.activeTrafficAlert
                      ? 'Courier in Heavy Traffic Jam'
                      : 'Heavy Traffic Jams Marked in Red'}
                  </p>
                  <p className="mt-1 text-xs text-red-800 leading-relaxed">
                    {activeOrder.activeTrafficAlert
                      ? `${activeOrder.activeTrafficAlert}. Rider speed reduced to ${activeOrder.courierSpeedKmh} km/h.`
                      : `${heavyJams.map((j) => j.roadName).join(' and ')} currently experiencing heavy congestion.`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* 4-Step Progress Connecting Restaurant and Delivery Boy */}
          <section className="bg-white border border-zinc-200 rounded-xl p-5">
            <h2 className="font-display text-base font-semibold text-zinc-900 mb-4">
              Order &amp; Dispatch Progress
            </h2>
            <ol className="space-y-4">
              {stages.map((stage, idx) => {
                const Icon = stage.icon;
                const done = idx <= stageIndex;
                const current = idx === stageIndex;
                return (
                  <li key={stage.title} className="flex items-start gap-3">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                        current
                          ? 'bg-[#D9381E] text-white border-[#D9381E]'
                          : done
                            ? 'bg-zinc-900 text-white border-zinc-900'
                            : 'bg-zinc-50 text-zinc-400 border-zinc-200'
                      }`}
                    >
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-sm font-semibold ${
                          done ? 'text-zinc-900' : 'text-zinc-400'
                        }`}
                      >
                        {stage.title}
                      </p>
                      <p className="text-xs text-zinc-500 truncate">{stage.detail}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>

          {/* Connected Parties: Restaurant & Delivery Boy */}
          <section className="bg-white border border-zinc-200 rounded-xl p-5 space-y-4">
            <h2 className="font-display text-base font-semibold text-zinc-900">
              Connected Parties
            </h2>

            {/* Restaurant Connection */}
            <div className="pb-4 border-b border-zinc-100 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <Store className="w-4 h-4 text-zinc-700 mt-1 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-xs text-zinc-500">Restaurant</p>
                  <p className="text-sm font-semibold text-zinc-900 truncate">
                    {activeOrder.restaurantName}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">
                    {activeOrder.restaurantAddress}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('restaurant')}
                className="px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
              >
                Kitchen View
              </button>
            </div>

            {/* Delivery Boy Connection */}
            <div className="pb-4 border-b border-zinc-100 flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <Bike className="w-4 h-4 text-[#D9381E] mt-1 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-xs text-zinc-500">Delivery Boy</p>
                  <p className="text-sm font-semibold text-zinc-900 truncate">
                    {activeOrder.courierName}
                  </p>
                  <p className="text-xs text-zinc-500 truncate">
                    {activeOrder.courierVehicle}
                  </p>
                  <p className="mt-1 inline-flex items-center gap-1 text-xs font-mono text-zinc-600">
                    <Phone className="w-3 h-3" aria-hidden="true" />
                    <span>{activeOrder.courierPhone}</span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('courier')}
                className="px-2.5 py-1.5 text-xs font-semibold text-zinc-700 hover:text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-md whitespace-nowrap shrink-0 cursor-pointer"
              >
                Rider View
              </button>
            </div>

            {/* Drop-off Address */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <MapPin className="w-4 h-4 text-teal-700 mt-1 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-xs text-zinc-500">Drop-Off Address</p>
                  <p className="text-sm font-medium text-zinc-900">
                    {activeOrder.deliveryAddress}
                  </p>
                  {activeOrder.deliveryNotes && (
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Note: {activeOrder.deliveryNotes}
                    </p>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onUseCurrentLocationForOrder(activeOrder.id)}
                disabled={locating || activeOrder.status === 'delivered'}
                className="px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-40"
              >
                Use GPS
              </button>
            </div>
          </section>

          {/* Itemized Receipt & Live Feed */}
          <section className="bg-white border border-zinc-200 rounded-xl p-5">
            <h2 className="font-display text-base font-semibold text-zinc-900 mb-3">
              Order Items &amp; Updates
            </h2>
            <ul className="space-y-2 text-sm pb-3 border-b border-zinc-100">
              {activeOrder.items.map((line) => (
                <li key={line.id} className="flex justify-between gap-2 text-zinc-700">
                  <span>
                    <span className="font-mono font-semibold text-zinc-900">
                      {line.quantity}×
                    </span>{' '}
                    {line.name}
                  </span>
                  <span className="font-mono text-zinc-900">
                    ${(line.price * line.quantity).toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="pt-2.5 flex justify-between text-sm font-semibold text-zinc-900">
              <span>Total Paid</span>
              <span className="font-mono">${activeOrder.total.toFixed(2)}</span>
            </div>

            <div className="mt-4 pt-3 border-t border-zinc-100 space-y-2">
              {activeOrder.events
                .slice(-3)
                .reverse()
                .map((evt) => (
                  <div
                    key={evt.id}
                    className="flex items-start justify-between gap-3 text-xs"
                  >
                    <span className="text-zinc-700">{evt.label}</span>
                    <span className="font-mono text-zinc-400 shrink-0">
                      {evt.time}
                    </span>
                  </div>
                ))}
            </div>
          </section>
        </aside>
      </div>
    </main>
  );
}
