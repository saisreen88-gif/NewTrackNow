export interface Coordinate {
  lat: number;
  lng: number;
}

export type DishCategory =
  | 'All'
  | 'Burgers'
  | 'Pizza'
  | 'Ramen'
  | 'Bowls'
  | 'Chicken'
  | 'Desserts';

export interface MenuItem {
  id: string;
  name: string;
  restaurantId: string;
  restaurantName: string;
  restaurantAddress: string;
  restaurantLocation: Coordinate;
  category: Exclude<DishCategory, 'All'>;
  description: string;
  price: number;
  prepMinutes: number;
  calories: number;
  imageUrl: string;
}

export interface CartItem {
  item: MenuItem;
  quantity: number;
}

export type TrafficSeverity = 'heavy' | 'moderate' | 'clear';

export interface TrafficSegment {
  id: string;
  roadName: string;
  severity: TrafficSeverity;
  delayMinutes: number;
  reason: string;
  points: Coordinate[];
  incidentPoint: Coordinate;
}

export type OrderStatus =
  | 'placed'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'picked_up'
  | 'en_route'
  | 'arriving'
  | 'delivered';

export interface OrderEvent {
  id: string;
  time: string;
  label: string;
  actor: 'customer' | 'restaurant' | 'courier';
}

export interface OrderItemLine {
  id: string;
  name: string;
  restaurantName: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryNotes: string;
  restaurantName: string;
  restaurantAddress: string;
  restaurantLocation: Coordinate;
  deliveryLocation: Coordinate;
  courierName: string;
  courierVehicle: string;
  courierPhone: string;
  courierLocation: Coordinate;
  courierSpeedKmh: number;
  autoDrive: boolean;
  routeWaypoints: Coordinate[];
  routeProgressIndex: number;
  etaMinutes: number;
  status: OrderStatus;
  items: OrderItemLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  inTrafficJam: boolean;
  activeTrafficAlert: string | null;
  createdAt: string;
  updatedAt: string;
  events: OrderEvent[];
}

export interface DeliveryPreset {
  id: string;
  label: string;
  address: string;
  location: Coordinate;
}

export type AppView = 'menu' | 'track' | 'restaurant' | 'courier';
