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
    }
};

module.exports = corsOptions;