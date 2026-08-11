/** Runs the real settlement job forward a couple of days so the demo has
 *  genuine payout records. Local-only tooling. */
import { runSettlements } from "../src/lib/settlement";

const now = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
runSettlements({ now })
  .then((r) => console.log(JSON.stringify(r, null, 2)))
  .catch((e) => { console.error(e); process.exit(1); });
