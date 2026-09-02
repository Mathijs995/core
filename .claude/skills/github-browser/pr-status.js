// GitHub PR status — run via Playwright MCP browser_evaluate (paste as `function`)
// while on a /<owner>/<repo>/pull/<n> page. Reports whether the PR is safe to merge.
// Verified against Mathijs995/core PRs #1 (merged) and #2 (open, green), Sep 2026.
() => {
  const txt = document.body.innerText;
  const has = (re) => re.test(txt);

  // Checks come from rendered text, not selectors: the current PR UI wraps them in
  // hashed module classes that change per deploy, and the old `.merge-status-item`
  // rows no longer render at all.
  //
  // `summary` ("1 successful check") is always present when the merge box is. The
  // per-check detail lines ("CI / check (pull_request)Successful in 53s") sit behind a
  // collapsed section and are often absent — treat `checks` as a bonus and decide from
  // the booleans. Both are empty once merged, since the merge box is removed.
  const summary = txt.match(/\d+ (?:successful|pending|failing|skipped)[^\n]*/g) || [];
  const OUTCOME =
    /(Successful in|Failing after|Cancelled|Skipped|Queued|In progress|Waiting for status|Expected)/;
  const checks = txt
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => OUTCOME.test(l) && l.length < 120);

  // The heading carries a screen-reader-only "- #<n>" suffix; drop it rather than
  // matching a class name, which GitHub rotates.
  const heading = document.querySelector('h1')?.cloneNode(true);
  heading?.querySelectorAll('.sr-only').forEach((e) => e.remove());

  return {
    number: location.pathname.match(/\/pull\/(\d+)/)?.[1] || null,
    title: heading?.innerText.trim() || null,
    // States are mutually exclusive; check merged first since a merged PR is also closed.
    state: has(/Pull request successfully merged|merged commit .* into/i)
      ? 'merged'
      : has(/This pull request is closed/i)
        ? 'closed'
        : 'open',
    allPassed: has(/All checks have passed/i),
    pending: has(/haven'?t completed yet|Waiting for status/i),
    failing: has(/checks were not successful|Some checks failed/i),
    conflict: has(/can[’']t automatically merge|This branch has conflicts/i),
    readyToMerge: has(/Ready to merge/i),
    summary,
    checks,
  };
}
