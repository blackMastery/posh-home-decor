# Mission

Posh Home Decor & Home Styling Studio (Georgetown, Guyana) needs a storefront where customers can browse the showroom online, build a bag and send the order to the shop on WhatsApp. Staff close the sale in the chat.

Ordering through WhatsApp is the **first step, not the end state**. v1 deliberately leaves out payment, accounts and delivery pricing so the shop can launch quickly and learn how customers buy. Each decision should still keep the path to real e-commerce open: inquiries capture structured data, products and prices are canonical in Postgres, and the bag is a clean model that a checkout could take over later.

Source of truth for v1 behaviour: [`posh-spec.md`](../posh-spec.md), which comes from the design review and the stakeholder interview.

## Who it's for

| Audience | What they need |
|---|---|
| **Georgetown shoppers on phones** (primary) | Fast, readable pages on mobile data. Clear prices in GYD, availability they can trust, and a handoff to WhatsApp that works on iPhone Safari and Android Chrome. |
| **Shop staff** (primary, one shared admin) | Add products, photos and stock changes from a phone in a few taps. A log of inquiries they can match to WhatsApp chats by reference (`PH-48213`). |
| **Diaspora and gift buyers** | People abroad buying for family in Guyana. They need clear delivery and collection wording, international phone numbers that work in WhatsApp, and prices that are unambiguous (GYD). |
| **Interior and trade clients** | Designers and businesses ordering several pieces or asking for styling help. They need good specifications (dimensions, materials), filters that hold up and a direct line to the studio. |

## What success looks like

- Customers reach WhatsApp with a correct, complete order message every time, including when popups are blocked or WhatsApp isn't installed.
- Staff keep the catalogue accurate without a desktop: sold-out items flip within seconds.
- Customer personal data stays private: the anon key can't read inquiries, and inquiries are deleted after 12 months.
- The site is fast and accessible: Lighthouse mobile ≥ 90 performance and ≥ 95 accessibility.
- When the shop is ready to take payment online, none of the v1 data model or URLs has to be thrown away.

## Principles

1. **Mobile first, on both sides.** Design for shoppers and staff on phones before desktop.
2. **WhatsApp is the checkout, for now.** Protect the send flow (`submitInquiry` → WhatsApp) above everything else.
3. **Simple over clever.** No statuses, stock counts or roles until the business asks for them (spec §1.2).
4. **Build toward e-commerce.** Choose schemas and boundaries that a future payment and accounts phase can extend rather than replace.
5. **Privacy by default.** RLS everywhere, minimal personal data, automatic retention.

## Not in v1 (from spec §1.2)

Online payment · customer accounts · stock quantities · order statuses · in-store POS · variants · delivery fees and zones · notifications · CSV import · multiple admins · multi-currency · WhatsApp Business API. These are candidates for a later e-commerce phase. They aren't scheduled in [`roadmap.md`](roadmap.md) yet.
