const getClientIP = require("./get-client-ip");
const argv = require("minimist")(process.argv.slice(2));
const fs = require("fs");
const path = require("path");
const config = require("../config");

function readIpFile(filePath) {
  return new Promise((resolve, reject) => {
    fs.readFile(
      path.resolve(__dirname, `../${filePath}`),
      "utf8",
      (err, data) => {
        if (err) {
          console.log(err);
          return resolve([]);
        }
        resolve(JSON.parse(data))
      }
    );
  });
}

/**
 * Simplest checker to check if certain request passes the small rule
 * @param {Object} req the request object to check for
 * @returns {Boolean}
 */
async function checkValidIP(req) {
  try {
    // don't check if checker not set
    if (!config.ip_filter.check_ip) return true;
    const defaultAccess = config.ip_filter.default_action || true;
    const allowedIPListFile = config.ip_filter.whitelist_file;
    if (!allowedIPListFile) {
      throw "ip checking is allowed without providing a ip list file.";
    }
    // read the json consisting ip list every time
    // so we don't have to reload and can change json file on fly

    // TODO: use watchers instead

    const allowed = await readIpFile(allowedIPListFile);
    console.log(`IP filters loaded: ${allowed.length}`);
    if (allowed.length) {
      // allow only if list has the specific ip
      const clientIP = getClientIP(req);
      const isUserAllowed = allowed.includes(clientIP);
      console.log({ clientIP, isUserAllowed });

      return isUserAllowed;
    }
    // allow access by default if no ip mentioned
    console.log({defaultAccess});
    return defaultAccess;
  } catch (e) {
    console.log(e);
    // disable access by default or on error
    return false;
  }
}
module.exports = checkValidIP;
