import { useCallback, useState } from 'react';
import { CheckCircle2, Navigation } from 'lucide-react';
import { CartDrawer } from './components/CartDrawer';
import { CourierConsole } from './components/CourierConsole';
import { Header } from './components/Header';
import { MenuView } from './components/MenuView';
import { RestaurantConsole } from './components/RestaurantConsole';
import { TrackOrderView } from './components/TrackOrderView';
import { DELIVERY_PRESETS } from './data/menuData';
import { useCurrentLocation } from './hooks/useCurrentLocation';
import { useTrackNowSocket } from './hooks/useTrackNowSocket';
import type {
  AppView,
  CartItem,
  DeliveryPreset,
  MenuItem,
  Order,
} from './types/tracknow';

export default function App() {
  const [activeView, setActiveView] = useState<AppView>('menu');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<DeliveryPreset>(
    DELIVERY_PRESETS[1],
  );
  const [currentLocationPreset, setCurrentLocationPreset] =
    useState<DeliveryPreset | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [recentOrderBanner, setRecentOrderBanner] = useState<Order | null>(null);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownloadProject = async () => {
    if (downloadingZip) return;
    setDownloadingZip(true);
    setDownloadError(null);
    try {
      const res = await fetch('/api/download-project', { cache: 'no-store' });
      if (!res.ok) throw new Error('Download failed');
      const buffer = await res.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      if (bytes.length < 4 || bytes[0] !== 0x50 || bytes[1] !== 0x4b) {
        throw new Error('Invalid ZIP payload received');
      }
      const blob = new Blob([buffer], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'tracknow-project.zip';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch {
      setDownloadError('Could not download ZIP archive. Please try again.');
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleResolvedLocation = useCallback((preset: DeliveryPreset) => {
    setCurrentLocationPreset(preset);
    setSelectedPreset(preset);
  }, []);

  const {
    location: viewerLocation,
    locating,
    error: locationError,
    requestCurrentLocation,
  } = useCurrentLocation(handleResolvedLocation);

  const {
    orders,
    trafficSegments,
    connected,
    loading,
    error,
    placeOrder,
    updateOrderDestination,
    advanceRestaurantStatus,
    updateCourierLocation,
    stepCourierForward,
    toggleCourierAutoDrive,
    updateCourierStatus,
    toggleTrafficSegment,
  } = useTrackNowSocket();

  const handleUseCurrentLocation = async () => {
    await requestCurrentLocation();
  };

  const handleUseCurrentLocationForOrder = async (orderId: string) => {
    const preset = await requestCurrentLocation();
    if (preset) {
      await updateOrderDestination(orderId, preset.location, preset.address);
    }
  };

  const handleAddToCart = (item: MenuItem) => {
    setCart((prev) => {
      const existing = prev.find((entry) => entry.item.id === item.id);
      if (existing) {
        return prev.map((entry) =>
          entry.item.id === item.id
            ? { ...entry, quantity: entry.quantity + 1 }
            : entry,
        );
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const handleUpdateQty = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((entry) =>
          entry.item.id === itemId
            ? { ...entry, quantity: entry.quantity + delta }
            : entry,
        )
        .filter((entry) => entry.quantity > 0),
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setCart((prev) => prev.filter((entry) => entry.item.id !== itemId));
  };

  const handleClearCart = () => {
    setCart([]);
  };

  const handleOrderCreated = (created: Order) => {
    setCartOpen(false);
    setSelectedOrderId(created.id);
    setRecentOrderBanner(created);
    setActiveView('track');
  };

  const handleGoToTrack = (orderId?: string) => {
    if (orderId) setSelectedOrderId(orderId);
    setActiveView('track');
  };

  const cartCount = cart.reduce((sum, entry) => sum + entry.quantity, 0);
  const latestActiveOrder =
    orders.find((o) => o.status !== 'delivered') || orders[0] || null;

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAF9] text-zinc-900">
      <Header
        activeView={activeView}
        onNavigate={(view) => {
          setActiveView(view);
        }}
        cartCount={cartCount}
        onOpenCart={() => setCartOpen(true)}
      />

      {error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2.5 text-center text-xs sm:text-sm text-red-900">
          {error}
        </div>
      )}

      {recentOrderBanner && activeView === 'track' && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs sm:text-sm text-emerald-900">
            <div className="inline-flex items-center gap-2 font-medium">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>
                Order <strong className="font-mono">{recentOrderBanner.orderNumber}</strong>{' '}
                placed and sent to {recentOrderBanner.restaurantName}. Live courier
                tracking is active below.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setRecentOrderBanner(null)}
              className="text-xs font-semibold text-emerald-800 hover:underline cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="flex-1">
        {loading && orders.length === 0 && activeView !== 'menu' ? (
          <div className="max-w-7xl mx-auto px-4 py-16 text-center text-sm text-zinc-500">
            Connecting to live order dispatch...
          </div>
        ) : activeView === 'menu' ? (
          <MenuView
            cart={cart}
            onAddToCart={handleAddToCart}
            onUpdateQty={handleUpdateQty}
            onOpenCart={() => setCartOpen(true)}
            onGoToTrack={handleGoToTrack}
            selectedPreset={selectedPreset}
            onSelectPreset={setSelectedPreset}
            currentLocationPreset={currentLocationPreset}
            locating={locating}
            locationError={locationError}
            onUseCurrentLocation={handleUseCurrentLocation}
            activeOrder={latestActiveOrder}
          />
        ) : activeView === 'track' ? (
          <TrackOrderView
            orders={orders}
            selectedOrderId={selectedOrderId}
            onSelectOrder={setSelectedOrderId}
            trafficSegments={trafficSegments}
            connected={connected}
            viewerLocation={viewerLocation}
            locating={locating}
            locationError={locationError}
            onUseCurrentLocationForOrder={handleUseCurrentLocationForOrder}
            onNavigate={setActiveView}
          />
        ) : activeView === 'restaurant' ? (
          <RestaurantConsole
            orders={orders}
            onAdvanceStatus={advanceRestaurantStatus}
            onTrackOrder={handleGoToTrack}
            onNavigate={setActiveView}
          />
        ) : (
          <CourierConsole
            orders={orders}
            selectedOrderId={selectedOrderId}
            onSelectOrder={setSelectedOrderId}
            trafficSegments={trafficSegments}
            viewerLocation={viewerLocation}
            onUpdateLocation={updateCourierLocation}
            onStepForward={stepCourierForward}
            onToggleAutoDrive={toggleCourierAutoDrive}
            onUpdateStatus={updateCourierStatus}
            onToggleTraffic={toggleTrafficSegment}
            onTrackOrder={handleGoToTrack}
          />
        )}
      </div>

      {/* Quick Track Floating Action on Menu when an order is live */}
      {activeView === 'menu' && latestActiveOrder && cartCount === 0 && (
        <div className="sticky bottom-4 z-20 flex justify-center px-4 pointer-events-none">
          <button
            type="button"
            onClick={() => handleGoToTrack(latestActiveOrder.id)}
            className="pointer-events-auto inline-flex items-center gap-2.5 px-5 py-2.5 bg-zinc-900 hover:bg-zinc-800 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-lg transition-colors cursor-pointer"
          >
            <Navigation className="w-4 h-4 text-[#D9381E]" aria-hidden="true" />
            <span>
              Track Active Order{' '}
              <span className="font-mono">{latestActiveOrder.orderNumber}</span> · ETA{' '}
              <span className="font-mono">{latestActiveOrder.etaMinutes}m</span>
            </span>
          </button>
        </div>
      )}

      <footer className="border-t border-zinc-200 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-zinc-500">
          <span className="font-display font-semibold text-zinc-800">TrackNow</span>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setActiveView('menu')}
              className="hover:text-zinc-900 cursor-pointer"
            >
              Menu
            </button>
            <button
              type="button"
              onClick={() => setActiveView('track')}
              className="hover:text-zinc-900 cursor-pointer"
            >
              Track Order
            </button>
            <button
              type="button"
              onClick={() => setActiveView('restaurant')}
              className="hover:text-zinc-900 cursor-pointer"
            >
              Restaurant Dispatch
            </button>
            <button
              type="button"
              onClick={() => setActiveView('courier')}
              className="hover:text-zinc-900 cursor-pointer"
            >
              Courier GPS
            </button>
            <button
              type="button"
              onClick={handleDownloadProject}
              disabled={downloadingZip}
              className="hover:text-zinc-900 underline underline-offset-4 cursor-pointer disabled:opacity-60"
            >
              {downloadingZip ? 'Preparing ZIP...' : 'Download Project (.zip)'}
            </button>
          </div>
          <span>&copy; 2026 TrackNow Delivery</span>
        </div>
        {downloadError && (
          <p className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4 text-xs text-red-700 text-center">
            {downloadError}
          </p>
        )}
      </footer>

      <CartDrawer
        open={cartOpen}
        onClose={() => setCartOpen(false)}
        cart={cart}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        selectedPreset={selectedPreset}
        onSelectPreset={setSelectedPreset}
        currentLocationPreset={currentLocationPreset}
        locating={locating}
        locationError={locationError}
        onUseCurrentLocation={handleUseCurrentLocation}
        onPlaceOrder={placeOrder}
        onOrderCreated={handleOrderCreated}
      />
    </div>
  );
}
