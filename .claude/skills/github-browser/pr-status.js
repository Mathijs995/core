// GitHub PR status — run via Playwright MCP browser_evaluate (paste as `function`)
// while on a /<owner>/<repo>/pull/<n> page. Reports whether the PR is safe to merge.
// Verified against Mathijs995/core PR #1, Sep 2026.
() => {
  const txt = document.body.innerText;
  const has = (re) => re.test(txt);

  // Merge-box rows carry one line per check: name, then outcome ("Successful in 59s").
  // Empty once the PR is merged — the whole merge box is removed, so trust `state` then.
  const checks = [...document.querySelectorAll('.merge-status-item')]
    .map((e) => e.innerText.replace(/\s*\n+\s*/g, ' — ').trim())
    .filter(Boolean);

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
    checks,
  };
}
