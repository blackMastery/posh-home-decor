/** Showroom landline. WhatsApp lives in the settings table; this number is fixed. */
export const LANDLINE = { display: "+592 223-9882", tel: "+5922239882" };

export const ADDRESS = {
  street: "240 Joseph Pollydore Street",
  city: "Georgetown",
  region: "Demerara-Mahaica",
  country: "Guyana",
};

export const ADDRESS_LINE = `${ADDRESS.street}, ${ADDRESS.city}, ${ADDRESS.country}`;
export const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ADDRESS_LINE)}`;
