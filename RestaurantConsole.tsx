import { Check, ChefHat, Navigation, PackageCheck, Store } from 'lucide-react';
import type { AppView, Order, OrderStatus } from '../types/tracknow';

interface RestaurantConsoleProps {
  orders: Order[];
  onAdvanceStatus: (orderId: string, status: OrderStatus) => void;
  onTrackOrder: (orderId: string) => void;
  onNavigate: (view: AppView) => void;
}

export function RestaurantConsole({
  orders,
  onAdvanceStatus,
  onTrackOrder,
}: RestaurantConsoleProps) {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="pb-6 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Restaurant Kitchen Dispatch
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold tracking-tight text-zinc-900">
            Incoming Orders &amp; Courier Handoff
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            Kitchen updates sync instantaneously with the customer&apos;s Track Order map
            and the assigned delivery boy.
          </p>
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="mt-8 bg-white border border-zinc-200 rounded-xl p-10 text-center text-sm text-zinc-500">
          No active kitchen tickets yet. Place an order from the Menu to receive a
          live kitchen ticket here.
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {orders.map((order) => {
            const isFinished = order.status === 'delivered';
            return (
              <article
                key={order.id}
                className="bg-white border border-zinc-200 rounded-xl p-6 flex flex-col justify-between gap-5"
              >
                <div>
                  <div className="flex items-center justify-between gap-3 pb-4 border-b border-zinc-100">
                    <div>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <span className="font-mono font-semibold text-zinc-900">
                          {order.orderNumber}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{order.restaurantName}</span>
                      </div>
                      <h2 className="mt-1 font-display text-lg font-semibold text-zinc-900">
                        {order.customerName}
                      </h2>
                    </div>

                    <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-md bg-zinc-100 text-zinc-800 uppercase">
                      {order.status.replace('_', ' ')}
                    </span>
                  </div>

                  <ul className="mt-4 space-y-2 text-sm">
                    {order.items.map((line) => (
                      <li key={line.id} className="flex justify-between text-zinc-700">
                        <span>
                          <strong className="font-mono text-zinc-900">
                            {line.quantity}×
                          </strong>{' '}
                          {line.name}
                        </span>
                        <span className="font-mono text-zinc-900">
                          ${(line.price * line.quantity).toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-4 pt-3 border-t border-zinc-100 text-xs text-zinc-500 space-y-1">
                    <p>
                      Assigned Delivery Boy:{' '}
                      <strong className="text-zinc-900">{order.courierName}</strong> (
                      {order.courierVehicle})
                    </p>
                    <p>Drop-off: {order.deliveryAddress}</p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-zinc-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={isFinished || order.status !== 'placed'}
                      onClick={() => onAdvanceStatus(order.id, 'accepted')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <Check className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Accept</span>
                    </button>

                    <button
                      type="button"
                      disabled={
                        isFinished ||
                        order.status === 'preparing' ||
                        order.status === 'ready' ||
                        order.status === 'picked_up' ||
                        order.status === 'en_route' ||
                        order.status === 'arriving'
                      }
                      onClick={() => onAdvanceStatus(order.id, 'preparing')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <ChefHat className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Preparing</span>
                    </button>

                    <button
                      type="button"
                      disabled={
                        isFinished ||
                        order.status === 'ready' ||
                        order.status === 'picked_up' ||
                        order.status === 'en_route' ||
                        order.status === 'arriving'
                      }
                      onClick={() => onAdvanceStatus(order.id, 'ready')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <PackageCheck className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Ready</span>
                    </button>

                    <button
                      type="button"
                      disabled={
                        isFinished ||
                        order.status === 'picked_up' ||
                        order.status === 'en_route' ||
                        order.status === 'arriving'
                      }
                      onClick={() => onAdvanceStatus(order.id, 'picked_up')}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#D9381E] text-white hover:bg-[#B82D17] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                    >
                      <Store className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Hand Off to Rider</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onTrackOrder(order.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-zinc-900 hover:underline cursor-pointer"
                  >
                    <Navigation className="w-3.5 h-3.5 text-[#D9381E]" aria-hidden="true" />
                    <span>View Live Map</span>
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
