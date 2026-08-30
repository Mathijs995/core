// Slack message extractor — run via Playwright MCP browser_evaluate (paste as `function`).
// Handles the virtualized message list: scrolls up HOPS viewports, harvesting as it goes,
// deduped by data-item-key (= message ts). Verified against BCG Slack, Aug 2026.
async () => {
  const HOPS = 5; // viewports of history to load above current position; raise for more
  const SCOPE = '.c-message_list'; // '[data-qa="threads_flexpane"]' for a thread, '.p-unreads_view' for unreads

  const root = document.querySelector(SCOPE);
  if (!root) return { error: `scope not found: ${SCOPE}` };
  const scroller = root.matches('.c-scrollbar__hider')
    ? root
    : root.querySelector('.c-scrollbar__hider') || root.closest('.c-scrollbar__hider');
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const collected = new Map();

  const harvest = () => {
    for (const item of root.querySelectorAll('[data-item-key]')) {
      const key = item.getAttribute('data-item-key');
      if (!/^\d+\.\d+$/.test(key)) continue; // date separators, sidebar rows, etc.
      const m = item.querySelector('[data-qa="message_container"]');
      if (!m) continue;
      const sender = m.querySelector('[data-qa="message_sender_name"]')?.textContent || null;
      if (collected.get(key)?.sender && !sender) continue; // keep the richer capture
      collected.set(key, {
        ts: key,
        time: m.querySelector('a.c-timestamp')?.getAttribute('aria-label') || null,
        sender,
        text: m.querySelector('[data-qa="message-text"]')?.innerText || '',
        replies: item.querySelector('[data-qa="reply_bar_count"]')?.textContent || null,
      });
    }
  };

  harvest();
  for (let i = 0; i < HOPS && scroller; i++) {
    if (scroller.scrollTop === 0) break; // reached top of loaded history
    scroller.scrollTop = Math.max(0, scroller.scrollTop - scroller.clientHeight * 0.8);
    await sleep(700); // let virtualization render + lazy-load
    harvest();
  }

  const messages = [...collected.values()].sort((a, b) => parseFloat(a.ts) - parseFloat(b.ts));
  // Slack only labels the first message of a consecutive group; fill the rest.
  let last = null;
  for (const m of messages) (m.sender ? (last = m.sender) : (m.sender = last));
  return { count: messages.length, messages };
}
