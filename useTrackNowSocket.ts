import { useCallback, useEffect, useRef, useState } from 'react';
import type { Coordinate, Order, OrderStatus, TrafficSegment } from '../types/tracknow';

interface SocketState {
  orders: Order[];
  trafficSegments: TrafficSegment[];
  connected: boolean;
  loading: boolean;
  error: string | null;
}

export function useTrackNowSocket() {
  const [state, setState] = useState<SocketState>({
    orders: [],
    trafficSegments: [],
    connected: false,
    loading: true,
    error: null,
  });

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<number | null>(null);

  const fetchInitialState = useCallback(async () => {
    try {
      const res = await fetch('/api/state');
      if (!res.ok) throw new Error('Failed to load tracking state');
      const data = (await res.json()) as {
        orders: Order[];
        trafficSegments: TrafficSegment[];
      };
      setState((prev) => ({
        ...prev,
        orders: data.orders,
        trafficSegments: data.trafficSegments,
        loading: false,
        error: null,
      }));
    } catch {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: 'Unable to connect to live order dispatch server.',
      }));
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchInitialState();

    function connect() {
      if (!active) return;
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        if (!active) return;
        setState((prev) => ({ ...prev, connected: true, error: null }));
      };

      socket.onmessage = (event) => {
        if (!active) return;
        try {
          const msg = JSON.parse(event.data) as {
            type: string;
            payload: unknown;
          };

          if (msg.type === 'init') {
            const payload = msg.payload as {
              orders: Order[];
              trafficSegments: TrafficSegment[];
            };
            setState((prev) => ({
              ...prev,
              orders: payload.orders,
              trafficSegments: payload.trafficSegments,
              loading: false,
            }));
          } else if (msg.type === 'order:created') {
            const created = msg.payload as Order;
            setState((prev) => {
              if (prev.orders.some((o) => o.id === created.id)) {
                return prev;
              }
              return { ...prev, orders: [created, ...prev.orders] };
            });
          } else if (msg.type === 'order:updated') {
            const updated = msg.payload as Order;
            setState((prev) => {
              const exists = prev.orders.some((o) => o.id === updated.id);
              const nextOrders = exists
                ? prev.orders.map((o) => (o.id === updated.id ? updated : o))
                : [updated, ...prev.orders];
              return { ...prev, orders: nextOrders };
            });
          } else if (msg.type === 'traffic:updated') {
            const payload = msg.payload as {
              trafficSegments: TrafficSegment[];
              orders: Order[];
            };
            setState((prev) => ({
              ...prev,
              trafficSegments: payload.trafficSegments,
              orders: payload.orders,
            }));
          }
        } catch {
          // Ignore invalid socket messages
        }
      };

      socket.onclose = () => {
        if (!active) return;
        setState((prev) => ({ ...prev, connected: false }));
        reconnectTimerRef.current = window.setTimeout(connect, 2000);
      };

      socket.onerror = () => {
        socket.close();
      };
    }

    connect();

    return () => {
      active = false;
      if (reconnectTimerRef.current) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
    };
  }, [fetchInitialState]);

  const sendMessage = useCallback((type: string, payload: Record<string, unknown>) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, payload }));
      return true;
    }
    return false;
  }, []);

  const advanceRestaurantStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      if (!sendMessage('restaurant:advance', { orderId, status })) {
        await fetch(`/api/orders/${orderId}/restaurant-status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
      }
    },
    [sendMessage],
  );

  const updateCourierLocation = useCallback(
    async (orderId: string, location: Coordinate) => {
      if (!sendMessage('courier:location', { orderId, lat: location.lat, lng: location.lng })) {
        await fetch(`/api/orders/${orderId}/courier-update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ location }),
        });
      }
    },
    [sendMessage],
  );

  const stepCourierForward = useCallback(
    async (orderId: string) => {
      if (!sendMessage('courier:step', { orderId })) {
        await fetch(`/api/orders/${orderId}/courier-update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ step: true }),
        });
      }
    },
    [sendMessage],
  );

  const toggleCourierAutoDrive = useCallback(
    async (orderId: string, enabled: boolean) => {
      if (!sendMessage('courier:toggle_autodrive', { orderId, enabled })) {
        await fetch(`/api/orders/${orderId}/courier-update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ autoDrive: enabled }),
        });
      }
    },
    [sendMessage],
  );

  const updateCourierStatus = useCallback(
    async (orderId: string, status: OrderStatus) => {
      if (!sendMessage('courier:status', { orderId, status })) {
        await fetch(`/api/orders/${orderId}/courier-update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        });
      }
    },
    [sendMessage],
  );

  const toggleTrafficSegment = useCallback(
    async (segmentId: string) => {
      if (!sendMessage('traffic:toggle', { segmentId })) {
        await fetch(`/api/traffic/${segmentId}/toggle`, { method: 'POST' });
      }
    },
    [sendMessage],
  );

  const placeOrder = useCallback(async (payload: Record<string, unknown>): Promise<Order> => {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error || 'Could not place order');
    }
    const created = (await res.json()) as Order;
    setState((prev) => {
      if (prev.orders.some((o) => o.id === created.id)) return prev;
      return { ...prev, orders: [created, ...prev.orders] };
    });
    return created;
  }, []);

  const updateOrderDestination = useCallback(
    async (orderId: string, location: Coordinate, address?: string) => {
      const res = await fetch(`/api/orders/${orderId}/destination`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location, address }),
      });
      if (res.ok) {
        const updated = (await res.json()) as Order;
        setState((prev) => ({
          ...prev,
          orders: prev.orders.map((o) => (o.id === updated.id ? updated : o)),
        }));
      }
    },
    [],
  );

  return {
    ...state,
    placeOrder,
    updateOrderDestination,
    advanceRestaurantStatus,
    updateCourierLocation,
    stepCourierForward,
    toggleCourierAutoDrive,
    updateCourierStatus,
    toggleTrafficSegment,
  };
}
