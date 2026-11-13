import { useState } from 'react';
import {
  LocateFixed,
  MapPin,
  Minus,
  Navigation,
  Plus,
  Search,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { DELIVERY_PRESETS, DISH_CATEGORIES, MENU_ITEMS } from '../data/menuData';
import type {
  CartItem,
  DeliveryPreset,
  DishCategory,
  MenuItem,
  Order,
} from '../types/tracknow';

interface MenuViewProps {
  cart: CartItem[];
  onAddToCart: (item: MenuItem) => void;
  onUpdateQty: (itemId: string, delta: number) => void;
  onOpenCart: () => void;
  onGoToTrack: (orderId?: string) => void;
  selectedPreset: DeliveryPreset;
  onSelectPreset: (preset: DeliveryPreset) => void;
  currentLocationPreset: DeliveryPreset | null;
  locating: boolean;
  locationError: string | null;
  onUseCurrentLocation: () => void;
  activeOrder: Order | null;
}

export function MenuView({
  cart,
  onAddToCart,
  onUpdateQty,
  onOpenCart,
  onGoToTrack,
  selectedPreset,
  onSelectPreset,
  currentLocationPreset,
  locating,
  locationError,
  onUseCurrentLocation,
  activeOrder,
}: MenuViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<DishCategory>('All');
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredItems = MENU_ITEMS.filter((item) => {
    const matchesCategory =
      selectedCategory === 'All' || item.category === selectedCategory;
    if (!matchesCategory) return false;
    if (!normalizedQuery) return true;
    return (
      item.name.toLowerCase().includes(normalizedQuery) ||
      item.restaurantName.toLowerCase().includes(normalizedQuery) ||
      item.category.toLowerCase().includes(normalizedQuery) ||
      item.description.toLowerCase().includes(normalizedQuery)
    );
  });

  const allPresets = currentLocationPreset
    ? [currentLocationPreset, ...DELIVERY_PRESETS]
    : DELIVERY_PRESETS;

  const cartCount = cart.reduce((sum, entry) => sum + entry.quantity, 0);
  const cartSubtotal = cart.reduce(
    (sum, entry) => sum + entry.item.price * entry.quantity,
    0,
  );

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
      {/* Top Hero Search & Delivery Destination Strip */}
      <section aria-labelledby="menu-heading" className="pb-8 border-b border-zinc-200">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 mb-2">
              Neighborhood Kitchens · Live Courier Dispatch
            </p>
            <h1
              id="menu-heading"
              className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-zinc-900 text-balance"
            >
              Order freshly prepared dishes, tracked street by street.
            </h1>
          </div>

          <div className="flex flex-col items-stretch sm:items-end gap-2">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <label className="flex items-center gap-2.5 px-3.5 py-2.5 bg-white border border-zinc-200 rounded-lg text-sm text-zinc-700 min-w-[240px] max-w-[340px]">
                <MapPin className="w-4 h-4 text-[#D9381E] shrink-0" aria-hidden="true" />
                <select
                  aria-label="Delivery destination"
                  value={selectedPreset.id}
                  onChange={(e) => {
                    const found = allPresets.find((p) => p.id === e.target.value);
                    if (found) onSelectPreset(found);
                  }}
                  className="w-full bg-transparent text-sm font-medium text-zinc-900 focus:outline-none cursor-pointer truncate"
                >
                  {allPresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.id === 'dest-current'
                        ? `Current: ${preset.address}`
                        : `Deliver to: ${preset.label}`}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={onUseCurrentLocation}
                disabled={locating}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 text-sm font-semibold text-zinc-900 bg-white border border-zinc-200 hover:border-zinc-900 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
              >
                <LocateFixed className="w-4 h-4 text-[#D9381E]" aria-hidden="true" />
                <span>{locating ? 'Locating...' : 'Use Current Location'}</span>
              </button>

              {activeOrder && (
                <button
                  type="button"
                  onClick={() => onGoToTrack(activeOrder.id)}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-zinc-900 bg-white border border-zinc-300 hover:border-zinc-900 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Navigation className="w-4 h-4 text-[#D9381E]" aria-hidden="true" />
                  <span>Track {activeOrder.orderNumber}</span>
                </button>
              )}
            </div>

            {selectedPreset.id === 'dest-current' && (
              <p className="text-xs text-zinc-600 font-mono">
                Delivering to live GPS: {selectedPreset.address}
              </p>
            )}
            {locationError && (
              <p className="text-xs text-red-700">{locationError}</p>
            )}
          </div>
        </div>

        {/* Search Bar + Category Segmented Tabs */}
        <div className="mt-6 flex flex-col md:flex-row items-stretch md:items-center gap-4">
          <div className="relative flex-1">
            <Search
              className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              aria-hidden="true"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search dishes, kitchens, or ingredients..."
              aria-label="Search dishes, kitchens, or ingredients"
              className="w-full pl-10 pr-10 py-2.5 bg-white border border-zinc-200 rounded-lg text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-zinc-900 transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div
            role="tablist"
            aria-label="Filter dishes by category"
            className="flex items-center gap-1 p-1 bg-zinc-100 rounded-lg overflow-x-auto"
          >
            {DISH_CATEGORIES.map((category) => {
              const active = selectedCategory === category;
              return (
                <button
                  key={category}
                  role="tab"
                  aria-selected={active}
                  type="button"
                  onClick={() => setSelectedCategory(category)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white text-zinc-900 shadow-xs'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {category}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Active Cart Summary Bar when items are added */}
      {cartCount > 0 && (
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-5 py-3.5 bg-white border border-zinc-200 rounded-xl">
          <div className="flex items-center gap-3 text-sm text-zinc-700">
            <span className="font-semibold text-zinc-900 font-mono">
              {cartCount} {cartCount === 1 ? 'item' : 'items'} in cart
            </span>
            <span aria-hidden="true" className="text-zinc-300">
              ·
            </span>
            <span>
              Subtotal{' '}
              <strong className="font-mono text-zinc-900">
                ${cartSubtotal.toFixed(2)}
              </strong>
            </span>
            <span aria-hidden="true" className="hidden sm:inline text-zinc-300">
              ·
            </span>
            <span className="hidden sm:inline text-zinc-500">
              {cartSubtotal >= 35
                ? 'Free delivery unlocked'
                : `Add $${(35 - cartSubtotal).toFixed(2)} for free delivery`}
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenCart}
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-[#D9381E] hover:bg-[#B82D17] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Review Cart &amp; Place Order
          </button>
        </div>
      )}

      {/* Dish Card Grid */}
      <section aria-label="Menu items" className="mt-8">
        {filteredItems.length === 0 ? (
          <div className="py-16 text-center bg-white border border-zinc-200 rounded-xl">
            <p className="text-base font-semibold text-zinc-900">
              No dishes matched &ldquo;{searchQuery}&rdquo;
            </p>
            <p className="mt-1 text-sm text-zinc-500">
              Try clearing your search or selecting another category.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedCategory('All');
              }}
              className="mt-4 px-4 py-2 text-sm font-medium text-zinc-900 bg-zinc-100 hover:bg-zinc-200 rounded-lg transition-colors cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {filteredItems.map((item) => {
              const cartEntry = cart.find((c) => c.item.id === item.id);
              const quantity = cartEntry?.quantity ?? 0;
              const imageFailed = failedImages[item.id];

              return (
                <article
                  key={item.id}
                  className="group bg-white border border-zinc-200 rounded-xl overflow-hidden flex flex-col transition-transform duration-200 hover:-translate-y-0.5"
                >
                  <div className="relative aspect-[4/3] w-full bg-zinc-100 overflow-hidden">
                    {!imageFailed ? (
                      <img
                        src={item.imageUrl}
                        alt={`${item.name} from ${item.restaurantName}`}
                        referrerPolicy="no-referrer"
                        onError={() =>
                          setFailedImages((prev) => ({ ...prev, [item.id]: true }))
                        }
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-100 text-zinc-500 px-6 text-center">
                        <UtensilsCrossed className="w-8 h-8 mb-2 text-zinc-400" />
                        <span className="text-sm font-medium text-zinc-700">
                          {item.name}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-1.5 text-xs text-zinc-500">
                        <span className="font-medium text-zinc-700">
                          {item.restaurantName}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{item.prepMinutes} min</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">{item.calories} kcal</span>
                      </div>

                      <h2 className="mt-1.5 font-display text-lg font-semibold text-zinc-900 leading-snug">
                        {item.name}
                      </h2>

                      <p className="mt-1.5 text-sm text-zinc-600 leading-relaxed line-clamp-2">
                        {item.description}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-zinc-100 flex items-center justify-between gap-4">
                      <span className="font-mono text-base font-semibold text-zinc-900">
                        ${item.price.toFixed(2)}
                      </span>

                      {quantity === 0 ? (
                        <button
                          type="button"
                          onClick={() => onAddToCart(item)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-zinc-900 hover:bg-[#D9381E] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D9381E]"
                        >
                          <Plus className="w-4 h-4" aria-hidden="true" />
                          <span>Add to Cart</span>
                        </button>
                      ) : (
                        <div className="inline-flex items-center gap-1 bg-zinc-100 rounded-lg p-1">
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.id, -1)}
                            aria-label={`Decrease quantity of ${item.name}`}
                            className="w-8 h-8 inline-flex items-center justify-center rounded-md bg-white text-zinc-900 hover:bg-zinc-200 transition-colors cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-8 text-center font-mono text-sm font-semibold text-zinc-900">
                            {quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => onUpdateQty(item.id, 1)}
                            aria-label={`Increase quantity of ${item.name}`}
                            className="w-8 h-8 inline-flex items-center justify-center rounded-md bg-white text-zinc-900 hover:bg-zinc-200 transition-colors cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
