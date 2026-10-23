# Changelog

All notable changes to this project are recorded here, grouped by date (newest first).

<!-- changelog-last-commit: 9a03ce214cb1520a4c6ad37105b17deb8baf226f -->

## 2026-10-23

- **Fixed:** Product links shared on Facebook (and WhatsApp, X, etc.) now show a thumbnail. Each product gets a branded 1200×630 share image showing the photo, name and price, which refreshes when the product changes.
- Product pages now have a meta description (built from the product's details when it has no description), product-specific X/Twitter tags, and Facebook product tags for price and availability.
- Richer Google product data: colour, material, dimensions, condition and seller. Product photos are now listed in the sitemap.

## 2026-10-21

- The shop page has a floating back-to-top button that appears after scrolling down, on both desktop and mobile.
- On phones and tablets, the shop's piece count and Filter button now stay pinned under the header while scrolling, so filters are always one tap away.
- Shop category navigation now shows parent categories above their subcategories: each level sits in its own indented row labelled like "In Decor", with an "All Decor" option, and sibling categories stay visible on deeper pages.

## 2026-10-20

- Product names are now formatted the same way everywhere: product pages, cards, the bag, the gallery viewer and search suggestions.

## 2026-10-19

- Added product attributes such as Colour, Material and Room, managed from a new Admin attributes page where they can be renamed, reordered, merged and safely deleted. Products can also store height, width, depth and diameter in cm.
- The shop now has faceted filtering by attribute, dimensions and price range, plus New, Sale, Coming soon and Hide sold out toggles, all with live counts. Filters sit in a sidebar on desktop and a bottom sheet on mobile. Products can also be sorted by size, using each category's main dimension.
- Added a header search overlay with instant suggestions. Search now also matches category names and attribute values.
- Product pages show a specifications table that links to filtered listings, and product cards show colour dots.
- Admin: create attribute values inline (with "did you mean" suggestions), a bulk edit page, a missing-data filter, and per-category shop filter settings.
- Adds a migration for attributes and dimensions (`20261020000000_attributes.sql`).

## 2026-10-12

- Contact details, including WhatsApp, now come from a single shared source instead of site settings. This updates the homepage and footer.

## 2026-10-09

- Image sizing and cropping are now more consistent across product cards, the product gallery, the bag and the gallery viewer.

## 2026-10-08

- Added a showroom gallery at `/gallery` with a masonry layout and a full-screen viewer. The viewer supports swiping, pinch and double-tap zoom, "Shop this look" product links, WhatsApp and share buttons, and links to individual photos. Gallery is now in the header nav and sitemap.
- Admin Gallery tab: upload several photos at once, drag to reorder, show or hide photos, and edit captions, alt text and linked products. Changes save immediately.
- The Admin product form can open photos full size.
- Added a "View the gallery" button with hover and tap animations.
- Products now have optional item code and UPC fields, with validation, in Admin.
- Breadcrumbs can hide the current page on mobile, and the product gallery layout works better on small screens.
- Adds migrations for the gallery (`20261008000000_gallery.sql`) and product codes (`20261009000000_product_codes.sql`).

## 2026-10-07

- Price is now optional. Unpriced products show "Price on request" and can still be added to the bag, with the price agreed on WhatsApp.
- Availability is now three options: available, coming soon or sold out. Coming-soon items can be pre-ordered and appear in a new `/shop/coming-soon` filter and a homepage strip.
- WhatsApp order messages flag unpriced and pre-order items, and the subtotal only counts priced items. Product structured data leaves out unknown prices and marks coming-soon items as pre-orders.
- Admin: optional price, a three-way availability control with a list filter and inline select, and change notes on inquiries.
- Added a site description and keywords to SEO metadata, and improved the homepage and product page metadata.
- Improved product gallery styling on different screen sizes.
- Adds a migration for optional price and availability (`20261007000000_optional_price_coming_soon.sql`).

## 2026-10-06

- Added an About page, with contact details in the header and footer, and added it to the sitemap.
- The footer now offers a landline number as a contact option.

## 2026-10-05

- Rebranded the colour palette from garnet to brown, and added new logo images and SEO metadata.
- Updated the logo, icons and social sharing image to the "Posh Home Decor & Home Styling Studio" branding.
- The homepage hero now shows a photo collage, with new studio photography.
- Updated button styles.
- Removed the styling studio section and its copy from the homepage, checkout and admin settings.
- Removed the seasonal hero eyebrow text.
- Adds migrations to clear the hero eyebrow (`20261005000000_clear_hero_eyebrow.sql`) and remove the studio copy (`20261005010000_drop_studio_copy.sql`).

## 2026-10-04

- Added a new homepage hero and simplified the hero settings in Admin.

## 2026-10-03

- Started the project with Next.js.
- Replaced the placeholder logo with the Posh brand badge and made the favicon and app icons from it.
- Set up the database: admins, settings, redirects, categories, products, product images, related products and inquiries, with row-level security. Inquiries older than 12 months are purged automatically, and seed data includes default settings, a category tree and sample products.
- Adds the initial migration (`20261003000000_init.sql`).
