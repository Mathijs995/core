---
name: vagaro-browser
description: Use when booking, rescheduling, or checking a Vagaro appointment via the browser — haircut, barber, salon, or spa bookings on vagaro.com — including "book me a haircut", "what times are free Saturday", "book the 10am slot", or any task touching vagaro.com with Playwright.
---

# Vagaro Booking via Browser (Playwright MCP)

Book appointments on a Vagaro business page (e.g.
`https://www.vagaro.com/landofbarbershairsalon/book-now`) using the Playwright MCP tools.

**Use the `pw-personal` server — `mcp__pw-personal__browser_*`.** Vagaro is a personal
account signed in with `mathijsdejong1995@gmail.com` via Google SSO, and that session
lives in the `~/pw-profiles/personal` profile. The BCG profile (`pw-bcg`) has no Vagaro
account.

**Core principles:**

1. **Booking is a money commitment. Confirm before the final `Book` click.** The
   business attaches a cancellation policy (typically 50% within 24h, 100% no-show) and
   puts a hold on a saved card. Fill the whole checkout, then **stop and confirm the
   service, barber, date, time, price, and card with the user** — unless they authorised
   the end-to-end booking in the current turn.
2. **Never guess the service.** Menus are not gendered and names vary per business. Read
   the real service list and confirm the mapping (see [Choosing a service](#choosing-a-service)).
3. **Read the DOM, not the screenshot.** Vagaro re-renders in place without changing the
   URL. A screenshot taken right after an action often shows the *previous* view. Always
   re-query the DOM to establish state.

## Page structure

| View | URL | Note |
| --- | --- | --- |
| Business landing | `/<business>/book-now` | Tabs: About, Staff, Services, Gift Cards, Products |
| Service menu | `/<business>/services` | Reached by clicking the **Services** tab |
| Slot picker | `/<business>/book-now` | Same URL as landing — distinguish by DOM |
| Checkout | `/<business>/book-now` | Same URL again — detect via `.service-div-checkout` |

Because three views share one URL, **`browser_navigate` is not a way to go back a step.**
Use the on-page `Back` button, or restart the flow from `/services`.

## Choosing a service

Read the whole menu in one call. Every service is an `article` carrying its id and price:

```js
() => [...document.querySelectorAll('article[data-serviceid]')].map(a => ({
  id: a.dataset.serviceid,
  price: a.dataset.price,
  name: a.querySelector('#pServiceTitle')?.innerText.trim(),
}))
```

`data-price` is the **base** price. Each staff member has their own tier — the real price
appears in the slot's `onclick` payload (see below) and can be higher.

**"A standard men's haircut" is not a menu item.** On Land of Barbers it maps to *Short
Haircut* ($50 — "clippers on the sides and scissors on top… classic short styles",
includes wash + blow-dry); *Medium Haircut* ($70) is the longer "gentlemen's cut" tier.
Other businesses name these differently. Confirm the mapping with the user before booking.

### Opening a service

Click `Book Now` **scoped to the article** — the page has one `Book Now` per service:

```text
article[data-serviceid="19087140"] button
```

An **add-on modal** opens (facial shave, beard trim, product consultation…). All add-ons
are optional; leave them unchecked unless asked. Then click **`#btnContinue`** — a bare
`:has-text("Continue")` matches three elements and fails strict mode.

## Picking a date and time

Day tiles are keyed by an exact-format date attribute — this is the only reliable
selector, since `text=SAT` matches every Saturday in the scroller:

```text
div[data-availdate="Sep 05,2026"]
```

Format is `MMM DD,YYYY`: three-letter month, **zero-padded** day, **no space** after the
comma. Getting this wrong silently matches nothing.

Slots are `a.time-link-block`, grouped under each staff member. The staff name, duration,
and true price live in the `onclick` payload rather than in any attribute:

```text
OnBookClick('05 Sep 2026 10:00 AM', '520582', '262331923', 'Luis Granados',
            '10:00 AM', '45', '50.00', ...)
                ↑ staffId    ↑ name       ↑ time  ↑ mins ↑ price
```

So to enumerate what is actually available, parse the handler:

```js
() => [...document.querySelectorAll('a.time-link-block')].map(b => {
  const f = (b.getAttribute('onclick') || '').split("','");
  return { time: b.innerText.trim(), staff: f[3], mins: f[5], price: f[6] };
})
```

To click one specific slot, tag it first, then click the tag — building a CSS selector
that matches on `onclick` contents is fragile:

```js
() => {
  const b = [...document.querySelectorAll('a.time-link-block')].find(
    x => x.innerText.trim() === '10:00 AM' && x.getAttribute('onclick').includes('Luis Granados'),
  );
  b.setAttribute('data-pick', 'chosen');
}
```

Then `browser_click` on `[data-pick="chosen"]`.

If the requested time is taken, the same list gives you the nearest alternatives — offer
them rather than silently shifting the appointment.

## Login (required — there is no guest checkout)

Clicking a slot while logged out opens a login modal. **Use `Log In with Google`.**

The OAuth flow opens a **second tab**. Switch to it with `browser_tabs`, click the
`mathijsdejong1995@gmail.com` account, then `Continue` on the consent screen. Two
gotchas:

- The consent `Continue` matches both a `<button>` and its inner `<span>` — target
  `button:has-text("Continue")` specifically.
- **The tab closes itself when OAuth completes**, so the click may return
  `Target page, context or browser has been closed`. **That is success, not failure.**
  Do not retry — switch back to tab 0 and check state.

After login the parent page restores the pending slot and advances straight to checkout.
A screenshot taken immediately may still show the old slot list; confirm with the DOM:

```js
() => !!document.querySelector('.service-div-checkout')
```

## Checkout

The checkout panel shows *Who Are You Booking For*, an optional notes box, saved payment
methods, the cancellation policy, and the totals sidebar.

**Payment.** Vagaro lists saved cards by last four (`Visa ending in 2109`), plus Apple
Pay, Google Pay, and New Payment Method. Click the saved card by its text. Typically the
card is only a **hold**: the sidebar reads `Total Due Now $0.00` with
`Total Due at Business $50.00`. Read those two lines back to the user — a business that
takes prepayment will show a non-zero *Due Now*, and that is a materially different
decision.

**Consent checkbox.** `#chkIsMailSendTextPreview` (the id is misleading — it is the
cancellation-policy checkbox, not a marketing opt-in). The input is zero-width and cannot
be clicked. **Click its label instead: `#lblCancellationPolicy`.** Verify it took:

```js
() => document.getElementById('chkIsMailSendTextPreview').checked
```

`Book` stays disabled until this is checked.

**Confirm, then submit.** Click `Book`. Success renders a full-page confirmation reading
**"Your appointment is booked."** with the date, time, staff, and service. Verify that
text before reporting success — Vagaro does not change the URL on completion, so a
still-on-checkout page looks identical to a booked one at a glance.

## Reporting back

Give the user the facts that let them show up and cancel: date, time, staff member,
service, address, amount due at the business, what was held on which card, and the
cancellation window.
