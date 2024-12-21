// Add a jwt authentication middleware 
const jwt = require("jsonwebtoken");

const jwtAuth = (req, res, next) => {
    // get token from bearer token
    const token = req.header("Authorization").split(" ")[1];
    if (!token) return res.status(401).send("Access Denied");

    try {
        const verified = jwt.verify(token, process.env.TOKEN_SECRET);
        req.user = verified;
        next();
    } catch (error) {
        res.status(400).send("Invalid Token");
    }
}

module.exports = jwtAuth;
