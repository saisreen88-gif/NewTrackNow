import type { DeliveryPreset, DishCategory, MenuItem } from '../types/tracknow';

export const DISH_CATEGORIES: DishCategory[] = [
  'All',
  'Burgers',
  'Pizza',
  'Ramen',
  'Bowls',
  'Chicken',
  'Desserts',
];

export const DELIVERY_PRESETS: DeliveryPreset[] = [
  {
    id: 'dest-civic',
    label: 'Civic Center Loft',
    address: '450 Larkin St, Civic Center, San Francisco',
    location: { lat: 37.7819, lng: -122.4167 },
  },
  {
    id: 'dest-fidi',
    label: 'Financial District Office',
    address: '525 Market St, Financial District, San Francisco',
    location: { lat: 37.7897, lng: -122.3999 },
  },
  {
    id: 'dest-mission',
    label: 'Mission Dolores Park',
    address: '620 Dolores St, Mission District, San Francisco',
    location: { lat: 37.7601, lng: -122.4265 },
  },
  {
    id: 'dest-waterfront',
    label: 'Embarcadero Pier 24',
    address: '240 The Embarcadero, Waterfront, San Francisco',
    location: { lat: 37.7918, lng: -122.3908 },
  },
];

export const MENU_ITEMS: MenuItem[] = [
  {
    id: 'dish-truffle-burger',
    name: 'Black Truffle Smash Burger',
    restaurantId: 'rest-foundry',
    restaurantName: 'Foundry Burger Kitchen',
    restaurantAddress: '785 Howard St, SoMa',
    restaurantLocation: { lat: 37.7833, lng: -122.4021 },
    category: 'Burgers',
    description:
      'Double dry-aged beef patties, aged Tillamook cheddar, charred sweet onions, and black truffle aioli on toasted brioche.',
    price: 18.5,
    prepMinutes: 16,
    calories: 790,
    imageUrl: '/src/assets/images/dish_truffle_burger_1794553763012.jpg',
  },
  {
    id: 'dish-margherita-pizza',
    name: 'Wood-Fired Margherita DOP',
    restaurantId: 'rest-forno',
    restaurantName: 'Forno Sourdough & Hearth',
    restaurantAddress: '518 Valencia St, Mission',
    restaurantLocation: { lat: 37.7646, lng: -122.4219 },
    category: 'Pizza',
    description:
      '48-hour fermented sourdough crust blistered at 900°F with crushed San Marzano tomatoes, fior di latte, and sweet basil.',
    price: 21.0,
    prepMinutes: 20,
    calories: 860,
    imageUrl: '/src/assets/images/dish_margherita_pizza_1794553764458.jpg',
  },
  {
    id: 'dish-tonkotsu-ramen',
    name: 'Black Garlic Tonkotsu Ramen',
    restaurantId: 'rest-kuro',
    restaurantName: 'Kuro Ramen House',
    restaurantAddress: '1122 Folsom St, SoMa',
    restaurantLocation: { lat: 37.7764, lng: -122.4086 },
    category: 'Ramen',
    description:
      '18-hour simmered pork bone broth, torched chashu belly, marinated soft-boiled egg, scallions, and roasted black garlic oil.',
    price: 19.5,
    prepMinutes: 18,
    calories: 710,
    imageUrl: '/src/assets/images/dish_tonkotsu_ramen_1794553763934.jpg',
  },
  {
    id: 'dish-salmon-poke',
    name: 'Wild King Salmon Poke Bowl',
    restaurantId: 'rest-pacific',
    restaurantName: 'Pacific Tide Bowl Co.',
    restaurantAddress: '330 Townsend St, SoMa',
    restaurantLocation: { lat: 37.7769, lng: -122.3958 },
    category: 'Bowls',
    description:
      'Sashimi-grade wild salmon tossed in yuzu-tamari glaze over seasoned brown sushi rice with avocado, edamame, and cucumber.',
    price: 20.5,
    prepMinutes: 12,
    calories: 560,
    imageUrl: '/src/assets/images/dish_salmon_poke_1794553764488.jpg',
  },
  {
    id: 'dish-crispy-chicken',
    name: 'Seoul Honey-Chili Crispy Chicken',
    restaurantId: 'rest-bap',
    restaurantName: 'Bap & Crunch Kitchen',
    restaurantAddress: '642 Post St, Union Square',
    restaurantLocation: { lat: 37.7878, lng: -122.4126 },
    category: 'Chicken',
    description:
      'Twice-fried boneless thighs lacquered in gochujang wildflower honey glaze with toasted sesame and house-pickled radish.',
    price: 17.5,
    prepMinutes: 15,
    calories: 690,
    imageUrl: '/src/assets/images/dish_crispy_chicken_1794553764442.jpg',
  },
  {
    id: 'dish-tiramisu-espresso',
    name: 'Artisan Mascarpone Tiramisu',
    restaurantId: 'rest-forno',
    restaurantName: 'Forno Sourdough & Hearth',
    restaurantAddress: '518 Valencia St, Mission',
    restaurantLocation: { lat: 37.7646, lng: -122.4219 },
    category: 'Desserts',
    description:
      'Savoiardi biscuits soaked in single-origin ristretto espresso, layered with whipped Lombardy mascarpone and dark Dutch cocoa.',
    price: 11.5,
    prepMinutes: 8,
    calories: 420,
    imageUrl: '/src/assets/images/dish_tiramisu_espresso_1794553765248.jpg',
  },
];
