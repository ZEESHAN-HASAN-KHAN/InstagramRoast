// Per-instance cap on how many roast jobs this Cloud Run instance processes at
// once, configurable via MAX_CONCURRENT_ROAST_JOBS so it's an easy lever to
// raise without any architecture change (claims are already safe to parallelize
// thanks to the atomic UPDATE ... WHERE status='queued' claim query).
let active = 0;
const waiters = [];

function limit() {
  return parseInt(process.env.MAX_CONCURRENT_ROAST_JOBS || "5", 10);
}

function acquire() {
  return new Promise((resolve) => {
    const tryAcquire = () => {
      if (active < limit()) {
        active++;
        resolve(release);
      } else {
        waiters.push(tryAcquire);
      }
    };
    tryAcquire();
  });
}

function release() {
  active--;
  const next = waiters.shift();
  if (next) next();
}

module.exports = { acquire };
