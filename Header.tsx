import { ShoppingBag } from 'lucide-react';
import type { AppView } from '../types/tracknow';

interface HeaderProps {
  activeView: AppView;
  onNavigate: (view: AppView) => void;
  cartCount: number;
  onOpenCart: () => void;
}

const NAV_ITEMS: Array<{ id: AppView; label: string }> = [
  { id: 'menu', label: 'Menu' },
  { id: 'track', label: 'Track Order' },
  { id: 'restaurant', label: 'Restaurant' },
  { id: 'courier', label: 'Courier' },
];

export function Header({
  activeView,
  onNavigate,
  cartCount,
  onOpenCart,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-zinc-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        <button
          type="button"
          onClick={() => onNavigate('menu')}
          className="font-display text-2xl font-bold tracking-tight text-zinc-900 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#D9381E]"
        >
          TrackNow
        </button>

        <nav
          aria-label="Primary navigation"
          className="flex items-center gap-4 sm:gap-7 overflow-x-auto"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.id)}
                className={`relative py-5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D9381E] ${
                  isActive
                    ? 'text-zinc-900'
                    : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                {item.label}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 bottom-0 h-0.5 bg-[#D9381E]"
                  />
                )}
              </button>
            );
          })}
        </nav>

        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onOpenCart}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#D9381E] hover:bg-[#B82D17] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D9381E]"
          >
            <ShoppingBag className="w-4 h-4" aria-hidden="true" />
            <span>Cart</span>
            <span className="font-mono text-xs bg-black/20 px-1.5 py-0.5 rounded">
              {cartCount}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
