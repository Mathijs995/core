// Trello board snapshot — run via Playwright MCP browser_evaluate (paste as `function`).
// Reads through Trello's REST API using the browser session cookie, so it sees every
// card, not just the ~20 the virtualized board canvas renders.
// Verified against "Mathijs | Tasks", Sep 2026.
async () => {
  const BOARD = 'MfTZJ6DT'; // short link from https://trello.com/b/<BOARD>
  const INCLUDE_DONE = false; // true to also return the "Done ✅" list

  const api = async (path) => {
    const r = await fetch(`https://trello.com/1${path}`, { credentials: 'include' });
    if (!r.ok) throw new Error(`GET ${path} → ${r.status} ${(await r.text()).slice(0, 120)}`);
    return r.json();
  };

  const lists = await api(
    `/boards/${BOARD}/lists?filter=open&fields=name` +
      '&cards=open&card_fields=name,shortLink,due,dueComplete,labels,badges,idMembers'
  );

  const out = lists
    .filter((l) => INCLUDE_DONE || !/^Done/.test(l.name))
    .map((l) => ({
      list: l.name,
      idList: l.id,
      count: l.cards.length,
      cards: l.cards.map((c) => ({
        name: c.name,
        id: c.shortLink, // usable directly as /1/cards/<shortLink>
        url: `https://trello.com/c/${c.shortLink}`,
        due: c.due,
        overdue: !!c.due && !c.dueComplete && new Date(c.due) < new Date(),
        dueComplete: c.dueComplete,
        labels: c.labels.map((x) => x.name || x.color),
        // badges surface work hidden inside the card without a second round trip
        checklist: c.badges.checkItems
          ? `${c.badges.checkItemsChecked}/${c.badges.checkItems}`
          : null,
        comments: c.badges.comments || 0,
        attachments: c.badges.attachments || 0,
        description: c.badges.description || false,
      })),
    }));

  return { board: BOARD, total: out.reduce((n, l) => n + l.count, 0), lists: out };
}
