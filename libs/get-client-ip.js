/**
 * Extract client ip from request
 * @param {Object} req
 * @returns {string} IP
 */
function getClientIP(req) {
  return (
    (
      req.headers["X-Forwarded-For"] ||
      req.headers["x-forwarded-for"] ||
      ""
    ).split(",")[0] || req.client.remoteAddress
  );
};

module.exports = getClientIP;