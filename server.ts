import { execFile } from 'child_process';
import express from 'express';
import fs from 'fs';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import type {
  Coordinate,
  Order,
  OrderEvent,
  OrderItemLine,
  OrderStatus,
  TrafficSegment,
} from './src/types/tracknow.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

function formatNowTime(): string {
  return new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function createEvent(
  label: string,
  actor: 'customer' | 'restaurant' | 'courier',
): OrderEvent {
  return {
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    time: formatNowTime(),
    label,
    actor,
  };
}

function distSq(a: Coordinate, b: Coordinate): number {
  const dLat = a.lat - b.lat;
  const dLng = a.lng - b.lng;
  return dLat * dLat + dLng * dLng;
}

function pointToSegmentDist(p: Coordinate, v: Coordinate, w: Coordinate): number {
  const l2 = distSq(v, w);
  if (l2 === 0) return Math.sqrt(distSq(p, v));
  let t = ((p.lat - v.lat) * (w.lat - v.lat) + (p.lng - v.lng) * (w.lng - v.lng)) / l2;
  t = Math.max(0, Math.min(1, t));
  const proj: Coordinate = {
    lat: v.lat + t * (w.lat - v.lat),
    lng: v.lng + t * (w.lng - v.lng),
  };
  return Math.sqrt(distSq(p, proj));
}

function buildStreetWaypoints(start: Coordinate, end: Coordinate): Coordinate[] {
  // Build a multi-turn urban street corridor path between restaurant and delivery drop-off
  const midTurn1: Coordinate = {
    lat: start.lat + (end.lat - start.lat) * 0.35,
    lng: start.lng + (end.lng - start.lng) * 0.15,
  };
  const midTurn2: Coordinate = {
    lat: start.lat + (end.lat - start.lat) * 0.55,
    lng: start.lng + (end.lng - start.lng) * 0.65,
  };
  const midTurn3: Coordinate = {
    lat: start.lat + (end.lat - start.lat) * 0.85,
    lng: start.lng + (end.lng - start.lng) * 0.82,
  };

  const anchors = [start, midTurn1, midTurn2, midTurn3, end];
  const points: Coordinate[] = [];
  const subSteps = 6;

  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    for (let s = 0; s < subSteps; s++) {
      const ratio = s / subSteps;
      points.push({
        lat: Number((a.lat + (b.lat - a.lat) * ratio).toFixed(6)),
        lng: Number((a.lng + (b.lng - a.lng) * ratio).toFixed(6)),
      });
    }
  }
  points.push({
    lat: Number(end.lat.toFixed(6)),
    lng: Number(end.lng.toFixed(6)),
  });
  return points;
}

const trafficSegments: TrafficSegment[] = [
  {
    id: 'traf-market-5th',
    roadName: 'Market St & 5th Ave',
    severity: 'heavy',
    delayMinutes: 7,
    reason: 'Heavy intersection congestion & lane closure',
    points: [
      { lat: 37.7815, lng: -122.4112 },
      { lat: 37.7842, lng: -122.4076 },
      { lat: 37.7869, lng: -122.4041 },
    ],
    incidentPoint: { lat: 37.7842, lng: -122.4076 },
  },
  {
    id: 'traf-folsom-4th',
    roadName: 'Folsom St & 4th St',
    severity: 'heavy',
    delayMinutes: 6,
    reason: 'Gridlock near I-80 ramp approach',
    points: [
      { lat: 37.7778, lng: -122.4044 },
      { lat: 37.7798, lng: -122.4018 },
      { lat: 37.7819, lng: -122.3991 },
    ],
    incidentPoint: { lat: 37.7798, lng: -122.4018 },
  },
  {
    id: 'traf-vanness-grove',
    roadName: 'Van Ness Ave & Grove St',
    severity: 'moderate',
    delayMinutes: 3,
    reason: 'Slow evening commute flow',
    points: [
      { lat: 37.7768, lng: -122.4193 },
      { lat: 37.7795, lng: -122.4197 },
      { lat: 37.7824, lng: -122.4202 },
    ],
    incidentPoint: { lat: 37.7795, lng: -122.4197 },
  },
  {
    id: 'traf-valencia-16th',
    roadName: 'Valencia St Corridor',
    severity: 'clear',
    delayMinutes: 0,
    reason: 'Normal bike & scooter flow',
    points: [
      { lat: 37.7646, lng: -122.4219 },
      { lat: 37.7689, lng: -122.4216 },
      { lat: 37.7731, lng: -122.4212 },
    ],
    incidentPoint: { lat: 37.7689, lng: -122.4216 },
  },
];

function checkTrafficAtLocation(loc: Coordinate): TrafficSegment | null {
  for (const seg of trafficSegments) {
    if (seg.severity !== 'heavy') continue;
    for (let i = 0; i < seg.points.length - 1; i++) {
      const d = pointToSegmentDist(loc, seg.points[i], seg.points[i + 1]);
      if (d < 0.0028) {
        return seg;
      }
    }
  }
  return null;
}

function checkRouteTrafficDelays(waypoints: Coordinate[]): number {
  const hitIds = new Set<string>();
  let totalDelay = 0;
  for (const wp of waypoints) {
    const seg = checkTrafficAtLocation(wp);
    if (seg && !hitIds.has(seg.id)) {
      hitIds.add(seg.id);
      totalDelay += seg.delayMinutes;
    }
  }
  return totalDelay;
}

function recalculateEta(order: Order): number {
  if (order.status === 'delivered') return 0;
  if (order.status === 'placed' || order.status === 'accepted') return 22;
  if (order.status === 'preparing') return 17;
  if (order.status === 'ready') return 13;

  const remainingPoints = order.routeWaypoints.slice(order.routeProgressIndex);
  const baseMinutes = Math.max(2, Math.ceil(remainingPoints.length * 0.55));
  const trafficDelay = checkRouteTrafficDelays(remainingPoints);
  return baseMinutes + trafficDelay;
}

const seedRestaurantLoc: Coordinate = { lat: 37.7764, lng: -122.4086 };
const seedDeliveryLoc: Coordinate = { lat: 37.7897, lng: -122.3999 };
const seedWaypoints = buildStreetWaypoints(seedRestaurantLoc, seedDeliveryLoc);
const seedInitialIdx = 6;

let orderSequence = 1042;

const orders: Order[] = [
  {
    id: 'order-1041',
    orderNumber: '#TN-1041',
    customerName: 'Maya Lin',
    customerPhone: '(415) 555-0148',
    deliveryAddress: '525 Market St, Financial District, San Francisco',
    deliveryNotes: 'Leave with lobby concierge',
    restaurantName: 'Kuro Ramen House',
    restaurantAddress: '1122 Folsom St, SoMa',
    restaurantLocation: seedRestaurantLoc,
    deliveryLocation: seedDeliveryLoc,
    courierName: 'Mateo Alvarez',
    courierVehicle: 'Electric Scooter · SF-408',
    courierPhone: '(415) 555-0192',
    courierLocation: seedWaypoints[seedInitialIdx],
    courierSpeedKmh: 26,
    autoDrive: true,
    routeWaypoints: seedWaypoints,
    routeProgressIndex: seedInitialIdx,
    etaMinutes: 14,
    status: 'en_route',
    items: [
      {
        id: 'dish-tonkotsu-ramen',
        name: 'Black Garlic Tonkotsu Ramen',
        restaurantName: 'Kuro Ramen House',
        price: 19.5,
        quantity: 2,
      },
    ],
    subtotal: 39.0,
    deliveryFee: 0,
    total: 39.0,
    inTrafficJam: false,
    activeTrafficAlert: null,
    createdAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    events: [
      createEvent('Order #TN-1041 placed by Maya Lin', 'customer'),
      createEvent('Kuro Ramen House accepted & prepared order', 'restaurant'),
      createEvent('Courier Mateo Alvarez picked up order & departed', 'courier'),
    ],
  },
];

// Recompute initial traffic & ETA on seed order
const seedTraffic = checkTrafficAtLocation(orders[0].courierLocation);
orders[0].inTrafficJam = Boolean(seedTraffic);
orders[0].activeTrafficAlert = seedTraffic
  ? `Heavy traffic jam on ${seedTraffic.roadName} (+${seedTraffic.delayMinutes} min)`
  : null;
orders[0].etaMinutes = recalculateEta(orders[0]);

const COURIER_ROSTER = [
  {
    name: 'Mateo Alvarez',
    vehicle: 'Electric Scooter · SF-408',
    phone: '(415) 555-0192',
  },
  {
    name: 'Devon Brooks',
    vehicle: 'Cargo E-Bike · SF-219',
    phone: '(415) 555-0174',
  },
  {
    name: 'Priya Nair',
    vehicle: 'Compact EV · SF-615',
    phone: '(415) 555-0163',
  },
];

const app = express();
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(type: string, payload: unknown): void {
  const message = JSON.stringify({ type, payload });
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

function updateOrderStatus(
  order: Order,
  status: OrderStatus,
  actor: 'customer' | 'restaurant' | 'courier',
  note?: string,
): void {
  order.status = status;
  order.updatedAt = new Date().toISOString();

  if (status === 'picked_up' && order.routeProgressIndex === 0) {
    order.courierLocation = order.routeWaypoints[0];
  }
  if (status === 'delivered') {
    order.routeProgressIndex = order.routeWaypoints.length - 1;
    order.courierLocation = order.deliveryLocation;
    order.courierSpeedKmh = 0;
    order.inTrafficJam = false;
    order.activeTrafficAlert = null;
    order.autoDrive = false;
  }

  order.etaMinutes = recalculateEta(order);
  const labelMap: Record<OrderStatus, string> = {
    placed: `Order ${order.orderNumber} received`,
    accepted: `${order.restaurantName} confirmed your order`,
    preparing: `${order.restaurantName} is firing your dishes`,
    ready: `Order packed & waiting for courier ${order.courierName}`,
    picked_up: `Courier ${order.courierName} picked up order from ${order.restaurantName}`,
    en_route: `Courier ${order.courierName} is en route to your address`,
    arriving: `Courier ${order.courierName} is arriving nearby`,
    delivered: `Order ${order.orderNumber} delivered`,
  };
  order.events.push(createEvent(note || labelMap[status], actor));
  broadcast('order:updated', order);
}

function advanceOrderStep(order: Order, stepCount = 1): void {
  if (order.status === 'delivered') return;
  if (
    order.status === 'placed' ||
    order.status === 'accepted' ||
    order.status === 'preparing' ||
    order.status === 'ready'
  ) {
    updateOrderStatus(order, 'picked_up', 'courier');
    return;
  }

  const maxIdx = order.routeWaypoints.length - 1;
  const nextIdx = Math.min(maxIdx, order.routeProgressIndex + stepCount);
  order.routeProgressIndex = nextIdx;
  order.courierLocation = order.routeWaypoints[nextIdx];
  order.updatedAt = new Date().toISOString();

  const hitTraffic = checkTrafficAtLocation(order.courierLocation);
  order.inTrafficJam = Boolean(hitTraffic);
  order.activeTrafficAlert = hitTraffic
    ? `Traffic jam on ${hitTraffic.roadName} (+${hitTraffic.delayMinutes} min)`
    : null;
  order.courierSpeedKmh = hitTraffic ? 7 : 29;

  if (nextIdx >= maxIdx) {
    updateOrderStatus(order, 'delivered', 'courier');
    return;
  }
  if (nextIdx >= maxIdx - 3 && order.status !== 'arriving') {
    updateOrderStatus(order, 'arriving', 'courier');
    return;
  }
  if (order.status === 'picked_up' && nextIdx >= 2) {
    order.status = 'en_route';
    order.events.push(
      createEvent(
        `Courier ${order.courierName} entered live delivery route`,
        'courier',
      ),
    );
  }

  order.etaMinutes = recalculateEta(order);
  broadcast('order:updated', order);
}

// Server-authoritative real-time courier telemetry & auto-dispatch tick
setInterval(() => {
  for (const order of orders) {
    if (!order.autoDrive) continue;
    if (order.status === 'picked_up' || order.status === 'en_route' || order.status === 'arriving') {
      // Slow down movement inside red traffic jams!
      if (order.inTrafficJam && Math.random() < 0.55) {
        order.etaMinutes = recalculateEta(order);
        order.updatedAt = new Date().toISOString();
        broadcast('order:updated', order);
        continue;
      }
      advanceOrderStep(order, 1);
    }
  }
}, 1500);

function scheduleInitialKitchenFlow(orderId: string): void {
  setTimeout(() => {
    const o = orders.find((x) => x.id === orderId);
    if (o && o.status === 'placed') updateOrderStatus(o, 'accepted', 'restaurant');
  }, 2200);

  setTimeout(() => {
    const o = orders.find((x) => x.id === orderId);
    if (o && o.status === 'accepted') updateOrderStatus(o, 'preparing', 'restaurant');
  }, 4600);

  setTimeout(() => {
    const o = orders.find((x) => x.id === orderId);
    if (o && o.status === 'preparing') updateOrderStatus(o, 'ready', 'restaurant');
  }, 7200);

  setTimeout(() => {
    const o = orders.find((x) => x.id === orderId);
    if (o && o.status === 'ready') {
      updateOrderStatus(o, 'picked_up', 'courier');
    }
  }, 9400);
}

// REST Endpoints
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'tracknow' });
});

app.get('/api/state', (_req, res) => {
  res.json({ orders, trafficSegments });
});

app.get('/api/reverse-geocode', async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    res.status(400).json({ error: 'Invalid coordinates' });
    return;
  }

  const fallback = `Current Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lng=${lng}&zoom=17`,
      {
        headers: {
          'User-Agent': 'TrackNow-DeliveryApp/1.0',
          Accept: 'application/json',
        },
        signal: controller.signal,
      },
    );
    clearTimeout(timer);
    if (!response.ok) {
      res.json({ address: fallback });
      return;
    }
    const data = (await response.json()) as {
      display_name?: string;
      address?: {
        road?: string;
        house_number?: string;
        suburb?: string;
        neighbourhood?: string;
        city?: string;
        town?: string;
      };
    };
    const parts = [
      [data.address?.house_number, data.address?.road].filter(Boolean).join(' '),
      data.address?.neighbourhood || data.address?.suburb,
      data.address?.city || data.address?.town,
    ].filter(Boolean);
    const address =
      parts.length > 0
        ? parts.join(', ')
        : data.display_name?.split(',').slice(0, 3).join(',').trim() || fallback;
    res.json({ address });
  } catch {
    res.json({ address: fallback });
  }
});

function anchorTrafficAround(center: Coordinate): void {
  // Replace segments with local street-corridor traffic segments around user's coordinates
  trafficSegments.splice(
    0,
    trafficSegments.length,
    {
      id: 'traf-local-1',
      roadName: 'Central Junction & Main Ave',
      severity: 'heavy',
      delayMinutes: 7,
      reason: 'Heavy intersection congestion & lane closure',
      points: [
        { lat: Number((center.lat - 0.0075).toFixed(6)), lng: Number((center.lng - 0.0055).toFixed(6)) },
        { lat: Number((center.lat - 0.0052).toFixed(6)), lng: Number((center.lng - 0.0032).toFixed(6)) },
        { lat: Number((center.lat - 0.0031).toFixed(6)), lng: Number((center.lng - 0.0014).toFixed(6)) },
      ],
      incidentPoint: {
        lat: Number((center.lat - 0.0052).toFixed(6)),
        lng: Number((center.lng - 0.0032).toFixed(6)),
      },
    },
    {
      id: 'traf-local-2',
      roadName: 'Eastbound Express Crossing',
      severity: 'heavy',
      delayMinutes: 6,
      reason: 'Slow-moving traffic jam near main signal',
      points: [
        { lat: Number((center.lat - 0.002).toFixed(6)), lng: Number((center.lng + 0.0025).toFixed(6)) },
        { lat: Number((center.lat + 0.0005).toFixed(6)), lng: Number((center.lng + 0.0042).toFixed(6)) },
        { lat: Number((center.lat + 0.0028).toFixed(6)), lng: Number((center.lng + 0.006).toFixed(6)) },
      ],
      incidentPoint: {
        lat: Number((center.lat + 0.0005).toFixed(6)),
        lng: Number((center.lng + 0.0042).toFixed(6)),
      },
    },
    {
      id: 'traf-local-3',
      roadName: 'Parkside Boulevard',
      severity: 'moderate',
      delayMinutes: 3,
      reason: 'Moderate evening traffic',
      points: [
        { lat: Number((center.lat + 0.0032).toFixed(6)), lng: Number((center.lng - 0.0045).toFixed(6)) },
        { lat: Number((center.lat + 0.0055).toFixed(6)), lng: Number((center.lng - 0.0025).toFixed(6)) },
      ],
      incidentPoint: {
        lat: Number((center.lat + 0.0044).toFixed(6)),
        lng: Number((center.lng - 0.0035).toFixed(6)),
      },
    },
  );
}

app.post('/api/traffic/anchor', (req, res) => {
  const { lat, lng } = req.body as { lat?: number; lng?: number };
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    res.status(400).json({ error: 'Invalid coordinates' });
    return;
  }

  const distFromSf = Math.hypot(lat - 37.78, lng - -122.41);
  if (distFromSf > 0.25) {
    anchorTrafficAround({ lat, lng });
    broadcast('traffic:updated', { trafficSegments, orders });
  }
  res.json({ trafficSegments });
});

app.post('/api/orders', (req, res) => {
  const {
    customerName,
    customerPhone,
    deliveryAddress,
    deliveryNotes,
    deliveryLocation,
    restaurantName,
    restaurantAddress,
    restaurantLocation,
    items,
  } = req.body as {
    customerName?: string;
    customerPhone?: string;
    deliveryAddress?: string;
    deliveryNotes?: string;
    deliveryLocation?: Coordinate;
    restaurantName?: string;
    restaurantAddress?: string;
    restaurantLocation?: Coordinate;
    items?: OrderItemLine[];
  };

  if (!items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ error: 'Cart must contain at least one item.' });
    return;
  }

  const cleanDestLoc: Coordinate =
    deliveryLocation && typeof deliveryLocation.lat === 'number'
      ? deliveryLocation
      : { lat: 37.7897, lng: -122.3999 };

  let cleanRestLoc: Coordinate =
    restaurantLocation && typeof restaurantLocation.lat === 'number'
      ? restaurantLocation
      : { lat: 37.7833, lng: -122.4021 };

  // If user selected their real current location outside SF metro, anchor the neighborhood kitchen & traffic locally
  const distBetween = Math.hypot(
    cleanDestLoc.lat - cleanRestLoc.lat,
    cleanDestLoc.lng - cleanRestLoc.lng,
  );
  if (distBetween > 0.25) {
    cleanRestLoc = {
      lat: Number((cleanDestLoc.lat - 0.0115).toFixed(6)),
      lng: Number((cleanDestLoc.lng - 0.0085).toFixed(6)),
    };
    anchorTrafficAround(cleanDestLoc);
    broadcast('traffic:updated', { trafficSegments, orders });
  }

  const subtotal = Number(
    items.reduce((sum, line) => sum + line.price * line.quantity, 0).toFixed(2),
  );
  const deliveryFee = subtotal >= 35 ? 0 : 2.99;
  const total = Number((subtotal + deliveryFee).toFixed(2));
  const courier = COURIER_ROSTER[orderSequence % COURIER_ROSTER.length];
  const waypoints = buildStreetWaypoints(cleanRestLoc, cleanDestLoc);

  const newOrder: Order = {
    id: `order-${orderSequence}`,
    orderNumber: `#TN-${orderSequence}`,
    customerName: (customerName || 'Alex Rivera').trim(),
    customerPhone: (customerPhone || '(415) 555-0110').trim(),
    deliveryAddress: (
      deliveryAddress || '525 Market St, Financial District, San Francisco'
    ).trim(),
    deliveryNotes: (deliveryNotes || '').trim(),
    restaurantName: restaurantName || items[0].restaurantName || 'Foundry Burger Kitchen',
    restaurantAddress: restaurantAddress || '785 Howard St, SoMa',
    restaurantLocation: cleanRestLoc,
    deliveryLocation: cleanDestLoc,
    courierName: courier.name,
    courierVehicle: courier.vehicle,
    courierPhone: courier.phone,
    courierLocation: cleanRestLoc,
    courierSpeedKmh: 0,
    autoDrive: true,
    routeWaypoints: waypoints,
    routeProgressIndex: 0,
    etaMinutes: 22,
    status: 'placed',
    items,
    subtotal,
    deliveryFee,
    total,
    inTrafficJam: false,
    activeTrafficAlert: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    events: [
      createEvent(
        `Order #TN-${orderSequence} placed by ${(customerName || 'Alex Rivera').trim()}`,
        'customer',
      ),
    ],
  };

  orderSequence += 1;
  orders.unshift(newOrder);
  broadcast('order:created', newOrder);
  scheduleInitialKitchenFlow(newOrder.id);

  res.status(201).json(newOrder);
});

app.post('/api/orders/:id/restaurant-status', (req, res) => {
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  const { status } = req.body as { status?: OrderStatus };
  if (!status) {
    res.status(400).json({ error: 'Missing status' });
    return;
  }
  updateOrderStatus(order, status, 'restaurant');
  res.json(order);
});

app.post('/api/orders/:id/courier-update', (req, res) => {
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  const { status, location, autoDrive, step } = req.body as {
    status?: OrderStatus;
    location?: Coordinate;
    autoDrive?: boolean;
    step?: boolean;
  };

  if (typeof autoDrive === 'boolean') {
    order.autoDrive = autoDrive;
  }
  if (location && typeof location.lat === 'number' && typeof location.lng === 'number') {
    order.courierLocation = location;
    const hitTraffic = checkTrafficAtLocation(location);
    order.inTrafficJam = Boolean(hitTraffic);
    order.activeTrafficAlert = hitTraffic
      ? `Traffic jam on ${hitTraffic.roadName} (+${hitTraffic.delayMinutes} min)`
      : null;
    order.courierSpeedKmh = hitTraffic ? 7 : 28;
    order.updatedAt = new Date().toISOString();
    order.events.push(
      createEvent(
        `Courier GPS updated (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})`,
        'courier',
      ),
    );
    broadcast('order:updated', order);
  }
  if (step) {
    advanceOrderStep(order, 1);
  }
  if (status) {
    updateOrderStatus(order, status, 'courier');
  } else if (!location && !step) {
    broadcast('order:updated', order);
  }
  res.json(order);
});

app.post('/api/orders/:id/destination', (req, res) => {
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) {
    res.status(404).json({ error: 'Order not found' });
    return;
  }
  const { location, address } = req.body as {
    location?: Coordinate;
    address?: string;
  };
  if (!location || typeof location.lat !== 'number' || typeof location.lng !== 'number') {
    res.status(400).json({ error: 'Invalid coordinates' });
    return;
  }

  order.deliveryLocation = location;
  if (address) {
    order.deliveryAddress = address;
  }

  const distFromRest = Math.hypot(
    location.lat - order.restaurantLocation.lat,
    location.lng - order.restaurantLocation.lng,
  );
  if (distFromRest > 0.25) {
    order.restaurantLocation = {
      lat: Number((location.lat - 0.0115).toFixed(6)),
      lng: Number((location.lng - 0.0085).toFixed(6)),
    };
    order.courierLocation = order.restaurantLocation;
    order.routeProgressIndex = 0;
    anchorTrafficAround(location);
    broadcast('traffic:updated', { trafficSegments, orders });
  }

  const startPoint =
    order.status === 'placed' ||
    order.status === 'accepted' ||
    order.status === 'preparing' ||
    order.status === 'ready'
      ? order.restaurantLocation
      : order.courierLocation;

  order.routeWaypoints = buildStreetWaypoints(startPoint, location);
  order.routeProgressIndex = 0;
  order.etaMinutes = recalculateEta(order);
  order.updatedAt = new Date().toISOString();
  order.events.push(
    createEvent(`Drop-off updated to current location`, 'customer'),
  );
  broadcast('order:updated', order);
  res.json(order);
});

app.post('/api/traffic/:id/toggle', (req, res) => {
  const seg = trafficSegments.find((s) => s.id === req.params.id);
  if (!seg) {
    res.status(404).json({ error: 'Traffic segment not found' });
    return;
  }
  if (seg.severity === 'heavy') {
    seg.severity = 'clear';
    seg.delayMinutes = 0;
    seg.reason = 'Traffic flowing normally';
  } else {
    seg.severity = 'heavy';
    seg.delayMinutes = 7;
    seg.reason = 'Heavy traffic jam reported ahead';
  }

  for (const order of orders) {
    if (order.status === 'delivered') continue;
    const hitTraffic = checkTrafficAtLocation(order.courierLocation);
    order.inTrafficJam = Boolean(hitTraffic);
    order.activeTrafficAlert = hitTraffic
      ? `Traffic jam on ${hitTraffic.roadName} (+${hitTraffic.delayMinutes} min)`
      : null;
    order.etaMinutes = recalculateEta(order);
    order.updatedAt = new Date().toISOString();
  }

  broadcast('traffic:updated', { trafficSegments, orders });
  res.json({ segment: seg, trafficSegments, orders });
});

app.get('/api/download-project', (_req, res) => {
  const outZip = `/tmp/tracknow-${Date.now()}-${Math.random().toString(36).slice(2, 7)}.zip`;
  const pyScript = `
import os, time, zipfile
root = os.getcwd()
out_path = ${JSON.stringify(outZip)}
skip_dirs = {'node_modules', 'dist', 'build', '.git', '.gmp_cache', '__pycache__'}
now = time.localtime()[:6]
with zipfile.ZipFile(out_path, 'w', zipfile.ZIP_DEFLATED) as zf:
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = sorted([d for d in dirnames if d not in skip_dirs])
        rel_dir = os.path.relpath(dirpath, root).replace(os.sep, '/')
        if rel_dir.startswith('public/assets/aistudio'):
            continue
        for fname in sorted(filenames):
            if fname.startswith('.env') and fname != '.env.example':
                continue
            if fname.endswith('.log'):
                continue
            full = os.path.join(dirpath, fname)
            rel = os.path.relpath(full, root).replace(os.sep, '/')
            arc = 'tracknow/' + rel
            info = zipfile.ZipInfo(arc, date_time=now)
            info.create_system = 0
            info.compress_type = zipfile.ZIP_DEFLATED
            with open(full, 'rb') as f:
                zf.writestr(info, f.read())
`;
  execFile('python3', ['-c', pyScript], { cwd: __dirname }, (err) => {
    if (err || !fs.existsSync(outZip)) {
      res.status(500).json({ error: 'Unable to package project archive.' });
      return;
    }
    fs.readFile(outZip, (readErr, buf) => {
      fs.unlink(outZip, () => {});
      if (readErr) {
        res.status(500).json({ error: 'Unable to read packaged archive.' });
        return;
      }
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="tracknow-project.zip"',
      );
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Length', String(buf.length));
      res.send(buf);
    });
  });
});

wss.on('connection', (ws) => {
  ws.send(JSON.stringify({ type: 'init', payload: { orders, trafficSegments } }));

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString()) as {
        type: string;
        payload?: Record<string, unknown>;
      };
      if (!msg.payload) return;

      if (msg.type === 'restaurant:advance') {
        const order = orders.find((o) => o.id === msg.payload?.orderId);
        const status = msg.payload?.status as OrderStatus | undefined;
        if (order && status) updateOrderStatus(order, status, 'restaurant');
      } else if (msg.type === 'courier:location') {
        const order = orders.find((o) => o.id === msg.payload?.orderId);
        const lat = Number(msg.payload?.lat);
        const lng = Number(msg.payload?.lng);
        if (order && !Number.isNaN(lat) && !Number.isNaN(lng)) {
          order.courierLocation = { lat, lng };
          if (
            order.status === 'placed' ||
            order.status === 'accepted' ||
            order.status === 'preparing' ||
            order.status === 'ready'
          ) {
            order.status = 'en_route';
          }
          const hitTraffic = checkTrafficAtLocation(order.courierLocation);
          order.inTrafficJam = Boolean(hitTraffic);
          order.activeTrafficAlert = hitTraffic
            ? `Traffic jam on ${hitTraffic.roadName} (+${hitTraffic.delayMinutes} min)`
            : null;
          order.courierSpeedKmh = hitTraffic ? 7 : 29;
          order.etaMinutes = recalculateEta(order);
          order.updatedAt = new Date().toISOString();
          broadcast('order:updated', order);
        }
      } else if (msg.type === 'courier:step') {
        const order = orders.find((o) => o.id === msg.payload?.orderId);
        if (order) advanceOrderStep(order, 1);
      } else if (msg.type === 'courier:toggle_autodrive') {
        const order = orders.find((o) => o.id === msg.payload?.orderId);
        if (order) {
          order.autoDrive = Boolean(msg.payload?.enabled);
          broadcast('order:updated', order);
        }
      } else if (msg.type === 'courier:status') {
        const order = orders.find((o) => o.id === msg.payload?.orderId);
        const status = msg.payload?.status as OrderStatus | undefined;
        if (order && status) updateOrderStatus(order, status, 'courier');
      } else if (msg.type === 'traffic:toggle') {
        const seg = trafficSegments.find((s) => s.id === msg.payload?.segmentId);
        if (seg) {
          if (seg.severity === 'heavy') {
            seg.severity = 'clear';
            seg.delayMinutes = 0;
            seg.reason = 'Traffic flowing normally';
          } else {
            seg.severity = 'heavy';
            seg.delayMinutes = 7;
            seg.reason = 'Heavy traffic jam reported ahead';
          }
          for (const order of orders) {
            if (order.status === 'delivered') continue;
            const hitTraffic = checkTrafficAtLocation(order.courierLocation);
            order.inTrafficJam = Boolean(hitTraffic);
            order.activeTrafficAlert = hitTraffic
              ? `Traffic jam on ${hitTraffic.roadName} (+${hitTraffic.delayMinutes} min)`
              : null;
            order.etaMinutes = recalculateEta(order);
          }
          broadcast('traffic:updated', { trafficSegments, orders });
        }
      }
    } catch {
      // Ignore malformed socket payloads
    }
  });
});

async function startServer(): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`TrackNow server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
