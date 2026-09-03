/**
 * Responsiveness audit.
 *
 * Measures, rather than asserts. For each route at each width it checks:
 *   - horizontal overflow of the document (the classic mobile bug)
 *   - any individual element wider than the viewport
 *   - tap targets below 36px in either dimension
 *   - text rendered below a 12px floor
 */
import { chromium } from "playwright";

const BASE = "http://localhost:3100";
const S = JSON.parse(process.env.CAPTURE_IDS);

const WIDTHS = [
  [320, "iPhone SE (smallest in real use)"],
  [360, "Android baseline"],
  [390, "iPhone 14"],
  [414, "iPhone Plus"],
  [768, "iPad portrait"],
  [1024, "iPad landscape / small laptop"],
  [1440, "Desktop"],
];

const ROUTES = [
  ["/", "Landing", false],
  [`/e/${S.eventSlug}`, "Event microsite", false],
  [`/e/${S.eventSlug}/basket`, "Basket", false],
  [`/s/${S.shopSlug}`, "Shop storefront", false],
  [`/t/${S.ticketToken}`, "Ticket badge", false],
  ["/signin", "Sign in", false],
  ["/find", "Find my ticket", false],
  [`/orders/${S.orderReference}`, "Order tracking", false],
  ["/dashboard", "Organiser console", "organiser"],
  [`/dashboard/events/${S.eventId}`, "Event detail", "organiser"],
  [`/dashboard/events/${S.eventId}/scan`, "Door scanner", "organiser"],
  [`/dashboard/events/${S.eventId}/team`, "Team", "organiser"],
  ["/shop", "Vendor console", "vendor"],
  ["/verify", "Verification", "vendor"],
  ["/payouts", "Payouts", "organiser"],
  ["/admin", "Admin", "organiser"],
];

const browser = await chromium.launch({
  executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
});

const AUDIT = () => {
  const vw = document.documentElement.clientWidth;
  const doc = document.documentElement;

  const overflowPx = Math.max(0, doc.scrollWidth - vw);

  const wide = [];
  const small = [];
  const tiny = [];

  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === "hidden" || cs.display === "none") continue;

    // An element sticking out past the viewport's right edge.
    if (r.right > vw + 1 && r.width > 4) {
      wide.push(`${el.tagName.toLowerCase()}${el.className ? "." + String(el.className).split(" ")[0] : ""} +${Math.round(r.right - vw)}px`);
    }

    // Interactive controls smaller than the 36px target the design claims.
    // WCAG 2.2 SC 2.5.8 exempts links inline in a block of text, and the skip
    // link is visually hidden until focused — neither is a real finding.
    const interactive = ["BUTTON", "A", "INPUT", "SELECT", "TEXTAREA"].includes(el.tagName);
    const parentText = el.parentElement ? getComputedStyle(el.parentElement).display : "";
    const inlineInText =
      el.tagName === "A" &&
      (parentText === "inline" || ["P", "SPAN", "LI", "FOOTER", "SMALL"].includes(el.parentElement?.tagName));
    const isSkip = /skip to/i.test(el.textContent || "");
    if (interactive && !inlineInText && !isSkip && r.width > 0 && (r.height < 36 || r.width < 36)) {
      const label = (el.textContent || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 24);
      small.push(`${label} ${Math.round(r.width)}x${Math.round(r.height)}`);
    }

    // Text below the 12px floor.
    const fs = parseFloat(cs.fontSize);
    if (fs && fs < 12 && el.textContent && el.textContent.trim().length > 2 && el.children.length === 0) {
      tiny.push(`${fs}px "${el.textContent.trim().slice(0, 20)}"`);
    }
  }

  return {
    overflowPx,
    wide: [...new Set(wide)].slice(0, 4),
    small: [...new Set(small)].slice(0, 4),
    tiny: [...new Set(tiny)].slice(0, 3),
    hasMain: !!document.querySelector("main"),
    hasSkip: !!document.querySelector('a[href="#main"], a[href^="#"][class*="skip"]'),
    viewportMeta: (document.querySelector('meta[name="viewport"]') || {}).content || "MISSING",
  };
};

const findings = [];
for (const [route, name, auth] of ROUTES) {
  for (const [w, wname] of WIDTHS) {
    const ctx = await browser.newContext({
      viewport: { width: w, height: 800 },
      deviceScaleFactor: 1,
      isMobile: w < 768,
      hasTouch: w < 768,
    });
    if (auth) {
      await ctx.addCookies([{
        name: "earnival_session",
        value: auth === "vendor" ? S.vendorSession : S.organiserSession,
        domain: "localhost", path: "/", httpOnly: true, sameSite: "Lax",
      }]);
    }
    const page = await ctx.newPage();
    try {
      await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 60000 });
      await page.waitForTimeout(500);
      const r = await page.evaluate(AUDIT);
      findings.push({ route: name, width: w, wname, ...r });
    } catch (e) {
      findings.push({ route: name, width: w, wname, error: String(e).split("\n")[0].slice(0, 70) });
    }
    await ctx.close();
  }
}

await browser.close();

// ── report ────────────────────────────────────────────────────────────
const problems = findings.filter(
  (f) => f.error || f.overflowPx > 0 || (f.wide || []).length || (f.small || []).length || (f.tiny || []).length,
);

console.log("=".repeat(72));
console.log(`RESPONSIVE AUDIT — ${ROUTES.length} routes x ${WIDTHS.length} widths = ${findings.length} checks`);
console.log("=".repeat(72));
console.log(`Clean:   ${findings.length - problems.length}`);
console.log(`Flagged: ${problems.length}`);
console.log();

const viewports = [...new Set(findings.map((f) => f.viewportMeta).filter(Boolean))];
console.log("viewport meta:", viewports.join(" | "));
console.log();

if (problems.length === 0) {
  console.log("No horizontal overflow, no undersized tap targets, no sub-12px text.");
} else {
  for (const f of problems) {
    console.log(`✗ ${f.route} @ ${f.width}px (${f.wname})`);
    if (f.error) console.log(`    error: ${f.error}`);
    if (f.overflowPx) console.log(`    page scrolls sideways by ${f.overflowPx}px`);
    if ((f.wide || []).length) console.log(`    overflowing: ${f.wide.join(", ")}`);
    if ((f.small || []).length) console.log(`    small targets: ${f.small.join(", ")}`);
    if ((f.tiny || []).length) console.log(`    tiny text: ${f.tiny.join(", ")}`);
  }
}

const noMain = findings.filter((f) => f.hasMain === false && !f.error);
if (noMain.length) {
  console.log(`\nRoutes without a <main> landmark: ${[...new Set(noMain.map((f) => f.route))].join(", ")}`);
}
