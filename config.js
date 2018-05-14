const argv = require("minimist")(process.argv.slice(2));

function getFromClient(key) {
  return argv[key] || process.env[key];
}

module.exports = {
  proxy_port: getFromClient("proxy_port") || 60000,
  proxy_file: getFromClient("proxy_list") || "data/proxies.json",
  retry_delay: getFromClient("retry_delay") || 1000,
  max_retries: getFromClient("max_retries") || 3,
  ip_filter: {
    check_ip: true,
    default_action: true,
    whitelist_file: getFromClient("whitelist_file") || "data/whilelist.json"
  }
};
