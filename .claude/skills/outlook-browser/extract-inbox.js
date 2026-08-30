// Outlook inbox/folder triage — run via Playwright MCP browser_evaluate (paste as `function`).
// Harvests each message-list row's aria-label (sender, subject, date, preview) without
// opening anything, scrolling the virtualized list HOPS viewports for older rows.
// Verified against BCG Outlook Web, Aug 2026.
async () => {
  const HOPS = 5; // viewports of additional rows to load; raise for more history

  const listbox = document.querySelector('[role="listbox"]');
  if (!listbox) return { error: 'message list not found' };
  let scroller = listbox;
  while (scroller && scroller.scrollHeight <= scroller.clientHeight) scroller = scroller.parentElement;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const collected = new Map();

  const harvest = () => {
    for (const row of document.querySelectorAll('[data-convid]')) {
      const id = row.getAttribute('data-convid');
      const label = row.getAttribute('aria-label');
      if (id && label && !collected.has(id)) collected.set(id, label);
    }
  };

  harvest();
  for (let i = 0; i < HOPS && scroller; i++) {
    const before = scroller.scrollTop;
    scroller.scrollTop += scroller.clientHeight * 0.9;
    await sleep(700); // let virtualization render
    harvest();
    if (scroller.scrollTop === before) break; // reached bottom
  }

  return { count: collected.size, rows: [...collected.values()] };
}
