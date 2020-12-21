#!/usr/bin/env node

"use strict";

const http = require("http");
const net = require("net");
const url = require("url");
const path = require("path");
const fs = require("fs");
const watchr = require("watchr");

const checkIPLimit = require("./libs/check-valid-ip");

const config = require("./config");
const proxyPort = config.proxy_port;
const retryDelay = config.retry_delay;
const maxRetries = config.max_retries;
const auth = {
  login: process.env.PROXY_USER,
  password: process.env.PROXY_PASSWORD
};

/**
 * Basic Proxy Authentication
 * default: disabled
 */
function loginEnabled() {
  return !!(auth.login && auth.password);
}

async function checkAuth(req, res) {
  // bypass login if not enabled
  if (!loginEnabled()) return true;

  // parse login and password from headers
  const authHeader =
    req.headers.authorization || req.headers["proxy-authorization"];
  const b64auth = (authHeader || "").split(" ")[1] || "";
  const [login, password] = Buffer.from(b64auth, "base64").toString().split(":");

  if (
    !login ||
    !password ||
    login !== auth.login ||
    password !== auth.password
  ) {
    res.statusCode = 401;
    res.setHeader("WWW-Authenticate", 'Basic realm="proxy-server"');
    res.end("Access denied");
    return;
  } else {
    return true;
  }
}

function loadProxies() {
  /**
   * Loads proxies from provided file using file argument
   */
  function getFromFile() {
    try {
      const proxyPath = path.resolve(`${process.cwd()}/${config.proxy_file}`);
      return JSON.parse(fs.readFileSync(proxyPath, "utf8"));
    } catch (e) {
      return null;
    }
  }

  /**
   * Loads proxies from env variable `PROXIES`
   */
  function getFromEnv() {
    try {
      return JSON.parse(process.env.PROXIES);
    } catch (e) {
      return null;
    }
  }

  /**
   * Handles proxies from user
   */
  try {
    // sets proxies
    const proxies = getFromFile() || getFromEnv();

    // if no proxies are loaded, then throw
    if (!proxies) throw "Proxies cannot be loaded";

    console.log(`Proxies loaded: ${proxies.length}`);
    return proxies;
  } catch (e) {
    throw e;

    // and exit process
    process.exit();
  }
}

/**
 * Sets several watchers for live reloading different configurations
 */
function setWatchers() {
  function next(err) {
    if (err) return console.log("watch failed with error", err);
    console.log("watch successful");
  }

  // watch for proxies
  watchr.open(
    path.resolve(`${process.cwd()}/${config.proxy_file}`),
    function proxyList() {
      proxies = loadProxies();
    },
    next
  );
}

/**
 * @return {object}
 */
const rotateProxyAddress = () => {
  const proxyAddress = proxies.shift();
  if (proxyAddress) {
    proxies.push(proxyAddress);
  }
  return proxyAddress;
};

/**
 * @param {ClientRequest} request
 * @param {object} proxy
 * @param {boolean} [ssl]
 */
const getOptions = (request, { port, host, auth }, ssl) => {
  const options = {
    port,
    hostname: host,
    method: request.method,
    path: request.url,
    headers: request.headers || {}
  };
  if (auth) {
    options.headers["Proxy-Authorization"] = `Basic ${Buffer.from(auth).toString(
      "base64"
    )}`;
  }

  if (ssl !== undefined) {
    const ph = url.parse(`http://${request.url}`);
    options.method = "CONNECT";
    options.path = `${ph.hostname}:${ph.port || 80}`;
  }

  return options;
};

/**
 * Handles HTTP requests
 * @param request
 * @param response
 * @param retries
 */

async function requestHandler(request, response, retries = 0) {
  console.log("requestHandler Request %s %s", request.method, request.url);
  const options = getOptions(request, rotateProxyAddress());
  const proxy = http.request(options);

  proxy
    .on("error", err => {
      // response.end();
      if (++retries < maxRetries) {
        setTimeout(() => {
          requestHandler(request, response, retries);
        }, retryDelay);
      } else {
        console.log(`[error] ${err}`);
        response.end();
      }
    })
    .on("response", proxyResponse => {
      console.log("Response received");
      if (proxyResponse.statusCode === 407) {
        console.log("[error] AUTH REQUIRED");
        response.end();
      }
      proxyResponse
        .on("data", chunk => {
          response.write(chunk, "binary");
        })
        .on("error", function(e) {
          console.log(e);
          response.end();
        })
        .on("timeout", function() {
          console.log("Request Timeout");
          response.end();
        })
        .on("end", () => {
          console.log("Request Ends");
          response.end();
        });
      response.writeHead(proxyResponse.statusCode, proxyResponse.headers);
    });

  proxy.end();

  request
    .on("data", chunk => {
      proxy.write(chunk, "binary");
    })
    .on("end", () => {
      proxy.end();
    });

  return;
}

/**
 * Handles HTTPS requests
 * @param request
 * @param response
 * @param retries
 */
async function socketHandler(request, socketRequest, retries = 0) {
  console.log("socketHandler Request %s %s", request.method, request.url);
  const options = getOptions(request, rotateProxyAddress(), true);

  const proxy = http.request(options);
  proxy
    .on("error", err => {
      console.log(`[error] ${err}`);
      if (++retries < maxRetries) {
        setTimeout(() => {
          socketHandler(request, socketRequest, retries);
        }, retryDelay);
      } else {
        socketRequest.end();
      }
    })
    .on("connect", (res, socket) => {
      socketRequest.write(
        `HTTP/${request.httpVersion} 200 Connection established\r\n\r\n`
      );

      // tunneling to host
      socket
        .on("data", chunk => {
          socketRequest.write(chunk, "binary");
        })
        .on("end", () => {
          socketRequest.end();
        })
        .on("error", () => {
          // notify client about an error
          socketRequest.write(
            `HTTP/${request.httpVersion} 500 Connection error\r\n\r\n`
          );
          socketRequest.end();
        });

      // tunneling to client
      socketRequest
        .on("data", chunk => {
          socket.write(chunk, "binary");
        })
        .on("end", () => {
          socket.end();
        })
        .on("error", () => {
          socket.end();
        });
    })
    .end();
  return;
}

/**
 * Master handler so we can do some checks before processing the real request
 * @param {string} method
 * @param {object} args
 */
async function masterHandler(method, args) {
  const [request, response] = args;
  const checker = await Promise.all([
    checkAuth(...args),
    checkIPLimit(...args)
  ]);
  const shouldContinue = checker.every(e => e);
  if (!shouldContinue) {
    response.statusCode=400;
    response.end("Access denied");
    return;
  }

  switch (method) {
    case "request":
      requestHandler(...args);
      break;
    case "connect":
      socketHandler(...args);
      break;
    default:
  }
}

// load proxy list
let proxies = loadProxies();

// set specific watchers
setWatchers();

// create server
const server = http.createServer();

// handle requests
server.on("request", (...args) => masterHandler("request", args));
server.on("connect", (...args) => masterHandler("connect", args));

console.log("Start proxy server on port %s", proxyPort);
server.listen(proxyPort);
