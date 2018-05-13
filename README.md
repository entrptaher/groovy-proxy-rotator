# groovy-proxy-rotator
Simple proxy rotator

This is derived from https://github.com/redco/goose-proxy-rotator, I've improved it and added some more configuration information.

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

5. create a new file called `proxies.json` with following content, the file must be a valid JSON. Assuming there are some proxies running at `127.0.0.1:10000` and `127.0.0.1:20000`, the file will look like below.

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

6. Save it and launch with `pm2`.
```
pm2 start process.json
```

Check on `http://YOURSERVERIP:60000` for your proxy with rotation.

If you ever want to change and reload proxies, then edit proxies file and reload the pm2 process for `proxy`,

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