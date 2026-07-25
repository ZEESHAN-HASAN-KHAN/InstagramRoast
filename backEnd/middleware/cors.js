const corsOptions = {
    origin: function (origin, callback) {
        // Allow specific origin or block others
        // allow request with the same origin by checking current domain vs origin
        const allowed = process.env.ALLOWED_ORIGIN.split(",");
        if(allowed.indexOf(origin) !== -1 || !origin) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    // Required for the `roast_session` cookie to ride along on cross-origin
    // fetches. Safe alongside the allowlist above — browsers reject credentialed
    // requests answered with a wildcard origin, and this never sends one.
    credentials: true
};

module.exports = corsOptions;