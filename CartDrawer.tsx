import { useState, type FormEvent } from 'react';
import { LocateFixed, Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react';
import { DELIVERY_PRESETS } from '../data/menuData';
import type { CartItem, DeliveryPreset, Order } from '../types/tracknow';

interface CartDrawerProps {
  open: boolean;
  onClose: () => void;
  cart: CartItem[];
  onUpdateQty: (itemId: string, delta: number) => void;
  onRemoveItem: (itemId: string) => void;
  onClearCart: () => void;
  selectedPreset: DeliveryPreset;
  onSelectPreset: (preset: DeliveryPreset) => void;
  currentLocationPreset: DeliveryPreset | null;
  locating: boolean;
  locationError: string | null;
  onUseCurrentLocation: () => void;
  onPlaceOrder: (payload: Record<string, unknown>) => Promise<Order>;
  onOrderCreated: (order: Order) => void;
}

export function CartDrawer({
  open,
  onClose,
  cart,
  onUpdateQty,
  onRemoveItem,
  onClearCart,
  selectedPreset,
  onSelectPreset,
  currentLocationPreset,
  locating,
  locationError,
  onUseCurrentLocation,
  onPlaceOrder,
  onOrderCreated,
}: CartDrawerProps) {
  const [customerName, setCustomerName] = useState('Jordan Patel');
  const [customerPhone, setCustomerPhone] = useState('(415) 555-0183');
  const [deliveryNotes, setDeliveryNotes] = useState('Ring bell at main entrance');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  if (!open) return null;

  const allPresets = currentLocationPreset
    ? [currentLocationPreset, ...DELIVERY_PRESETS]
    : DELIVERY_PRESETS;

  const subtotal = Number(
    cart.reduce((sum, c) => sum + c.item.price * c.quantity, 0).toFixed(2),
  );
  const deliveryFee = subtotal === 0 || subtotal >= 35 ? 0 : 2.99;
  const total = Number((subtotal + deliveryFee).toFixed(2));
  const primaryRestaurant = cart[0]?.item;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (cart.length === 0 || submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const order = await onPlaceOrder({
        customerName,
        customerPhone,
        deliveryAddress: selectedPreset.address,
        deliveryNotes,
        deliveryLocation: selectedPreset.location,
        restaurantName: primaryRestaurant?.restaurantName,
        restaurantAddress: primaryRestaurant?.restaurantAddress,
        restaurantLocation: primaryRestaurant?.restaurantLocation,
        items: cart.map((c) => ({
          id: c.item.id,
          name: c.item.name,
          restaurantName: c.item.restaurantName,
          price: c.item.price,
          quantity: c.quantity,
        })),
      });
      onClearCart();
      onOrderCreated(order);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Unable to submit your order right now.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-zinc-950/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-label="Your cart and checkout"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <aside className="relative z-10 w-full max-w-md bg-white h-full flex flex-col border-l border-zinc-200 shadow-2xl">
        <div className="px-6 py-4 border-b border-zinc-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-5 h-5 text-zinc-900" aria-hidden="true" />
            <h2 className="font-display text-lg font-semibold text-zinc-900">
              Your Order Cart
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cart"
            className="p-2 text-zinc-500 hover:text-zinc-900 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
            <ShoppingBag className="w-10 h-10 text-zinc-300 mb-3" aria-hidden="true" />
            <p className="font-display text-base font-semibold text-zinc-900">
              Your cart is empty
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Add dishes from the TrackNow menu to place an order and track your delivery
              live on the map.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 px-4 py-2 text-sm font-semibold text-white bg-zinc-900 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
            >
              Browse Dishes
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Cart Items */}
              <div className="space-y-4">
                {cart.map(({ item, quantity }) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3.5 pb-4 border-b border-zinc-100 last:border-b-0 last:pb-0"
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      referrerPolicy="no-referrer"
                      className="w-16 h-16 rounded-lg object-cover bg-zinc-100 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-zinc-900 truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-zinc-500">{item.restaurantName}</p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <div className="inline-flex items-center gap-1 bg-zinc-100 rounded-md p-0.5">
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.id, -1)}
                            aria-label={`Decrease ${item.name}`}
                            className="w-6 h-6 inline-flex items-center justify-center rounded bg-white text-zinc-900 hover:bg-zinc-200 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="w-6 text-center font-mono text-xs font-semibold text-zinc-900">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.id, 1)}
                            aria-label={`Increase ${item.name}`}
                            className="w-6 h-6 inline-flex items-center justify-center rounded bg-white text-zinc-900 hover:bg-zinc-200 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-zinc-900">
                            ${(item.price * quantity).toFixed(2)}
                          </span>
                          <button
                            type="button"
                            onClick={() => onRemoveItem(item.id)}
                            aria-label={`Remove ${item.name}`}
                            className="p-1 text-zinc-400 hover:text-red-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Delivery Details */}
              <div className="pt-4 border-t border-zinc-200 space-y-3.5">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Delivery Destination &amp; Contact
                  </h3>
                  <button
                    type="button"
                    onClick={onUseCurrentLocation}
                    disabled={locating}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#D9381E] hover:text-[#B82D17] cursor-pointer disabled:opacity-60"
                  >
                    <LocateFixed className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{locating ? 'Locating...' : 'Use Current Location'}</span>
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Drop-Off Location
                  </label>
                  <select
                    value={selectedPreset.id}
                    onChange={(e) => {
                      const found = allPresets.find((p) => p.id === e.target.value);
                      if (found) onSelectPreset(found);
                    }}
                    className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:border-zinc-900"
                  >
                    {allPresets.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label} — {preset.address}
                      </option>
                    ))}
                  </select>
                  {locationError && (
                    <p className="mt-1 text-xs text-red-700">{locationError}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Recipient Name
                    </label>
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:border-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-700 mb-1">
                      Phone Number
                    </label>
                    <input
                      type="tel"
                      required
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:border-zinc-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-zinc-700 mb-1">
                    Delivery Instructions
                  </label>
                  <input
                    type="text"
                    value={deliveryNotes}
                    onChange={(e) => setDeliveryNotes(e.target.value)}
                    placeholder="Gate code, floor, or drop-off note"
                    className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:border-zinc-900"
                  />
                </div>
              </div>
            </div>

            {/* Order Totals & Place Order CTA */}
            <div className="px-6 py-5 bg-zinc-50 border-t border-zinc-200 space-y-3">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-zinc-600">
                  <span>Subtotal</span>
                  <span className="font-mono">${subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-zinc-600">
                  <span>Courier Delivery</span>
                  <span className="font-mono">
                    {deliveryFee === 0 ? 'Free' : `$${deliveryFee.toFixed(2)}`}
                  </span>
                </div>
                <div className="pt-2 border-t border-zinc-200 flex justify-between text-base font-semibold text-zinc-900">
                  <span>Total</span>
                  <span className="font-mono">${total.toFixed(2)}</span>
                </div>
              </div>

              {submitError && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {submitError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 text-sm font-semibold text-white bg-[#D9381E] hover:bg-[#B82D17] disabled:opacity-60 rounded-lg transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D9381E]"
              >
                {submitting ? 'Placing Order...' : `Place Order · $${total.toFixed(2)}`}
              </button>
            </div>
          </form>
        )}
      </aside>
    </div>
  );
}
