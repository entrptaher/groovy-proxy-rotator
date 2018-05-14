# groovy-proxy-rotator
Simple proxy rotator

This is derived from the following,
- https://github.com/entrptaher/groovy-proxy-rotator-old 
- https://github.com/redco/goose-proxy-rotator

I've improved it and added some more configuration information.

NOTE: THE LAST DEPLOYMENT IS NOT DOCUMENTED. WAIT TILL IT IS DOCUMENTED.

## Usage

1. Clone the repo.
2. cd into the cloned folder.
3. install pm2 globally using,
```
npm i -g pm2
```
4. install all required modules
```
npm install
```

5. You must create a new file called `data/proxies.json` with following content, the file must be a valid JSON. Assuming there are some proxies running at `127.0.0.1:10000` and `127.0.0.1:20000`, the file will look like below.

```json
[
    {
       "host":"127.0.0.1",
       "port":10000
    }, 
    {
       "host":"127.0.0.1",
       "port":20000
    }
]
```

6. If you want to whitelist certain IP, then create a file `data/whitelist.json` and put data in an array. By default it will allow all traffic. If you keep the list empty, it'll also allow all traffic, but if there is any ip in the list, then filtering will be enabled. If you want to keep the list but disable the filter, then edit the process.json and add an argument called `check_ip` inside `env` or `args`, 

```
[
    "192.168.0.8", "::ffff:192.168.0.8"
]
```
You must provide ipv6 address if the client you are using is ipv6.

7. Save it and launch with `pm2`.
```
pm2 start process.json
```

Check on `http://YOURSERVERIP:60000` for your proxy with rotation.

If you ever want to change and reload proxies, then edit proxies file and reload the pm2 process for `proxy`, check `process.json` and `config.js` for more details.

```
pm2 restart proxy
```

### Start without configuring any json file or pm2

Provide `PROXYPORT` and `PROXIES` like below and run the rotator
```
PROXYPORT=56000 PROXIES='[{"host": "IP", "port": 60000}]' npm start
```

The proxy will run at port `56000`.

### Internal Proxy Authentication
If you want to protect your proxy from being abused by public, then you might as well add some simple authentication.
Use `PROXY_USER` and `PROXY_PASSWORD` to enable simple authentiction.

#### Setup:

Example `PROXY_USER=admin PROXY_PASSWORD=admin npm start` will use proxies file with default port. But then when you use the proxy you must provide authentication info.

#### Usage:

```
curl -x http://admin:admin@127.0.0.1:56000 http://httpbin.org/ip
```

### Authentication

If your proxy has authentication, then add `auth` beside `host` and `port` for that proxy.

```json
[{
       "host":"ip",
       "port":"port",
       "auth":"username:password"
}]
```
### Other options

There are other options available via `env`.

- `RETRY_DELAY` retry after `XXXX ms` if request fails. ie: `RETRY_DELAY=1000` means it will retry after 1000 ms or 1 s, default is `1000`.
- `MAX_RETRIES` how many times to retry, default is `3`.

### Limitations
- Sometimes the long-lived `keep-alive` requests drops.
- the package is by default `http` and not `https`, your proxy can be `https` but it will be served using `http`. You can ssl by some other means like cloudflare etc.