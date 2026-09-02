const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadOnRequest() {
  const file = path.join(__dirname, '..', 'src', 'content', 'on-request.js');
  const source = fs.readFileSync(file, 'utf8')
    .replace(/^import .*;\n/gm, '')
    .replace('export class OnRequest', 'class OnRequest') +
    '\nglobalThis.OnRequest = OnRequest;\n';

  let onRequest;
  const browser = {
    action: {
      setBadgeBackgroundColor() {},
      setBadgeText() {},
      setTitle() {},
    },
    proxy: {
      onRequest: {
        addListener(listener) {
          onRequest = listener;
        },
      },
    },
    storage: {
      session: {
        get: async () => ({}),
        set() {},
      },
    },
    tabs: {
      onCreated: {addListener() {}},
      onRemoved: {addListener() {}},
      onUpdated: {addListener() {}},
    },
  };

  const context = {
    App: {allowedTabProxy: () => true},
    Location: {get: () => ''},
    Pattern: {
      get: pattern => pattern,
      getPassthrough: () => [[], [], []],
    },
    RegExp,
    URL,
    browser,
    btoa: value => Buffer.from(value).toString('base64'),
  };

  vm.runInNewContext(source, context, {filename: file});
  return {OnRequest: context.OnRequest, onRequest};
}

function getPref(mode = 'pattern') {
  return {
    container: {},
    data: [{
      active: true,
      cc: 'RU',
      city: '',
      color: '#fff',
      exclude: [],
      hostname: 'proxy.example',
      include: [{active: true, pattern: 'example\\.ru/', type: 'regex'}],
      password: '',
      port: '1080',
      proxyDNS: true,
      tabProxy: [],
      title: 'Russian proxy',
      type: 'socks5',
      username: '',
    }],
    mode,
    passthrough: '',
  };
}

function getRequest(url = 'https://service.example.ru/auth/sign-in') {
  return {
    cookieStoreId: 'firefox-default',
    incognito: false,
    tabId: 1,
    type: 'main_frame',
    url,
  };
}

test('routes a matching request through the configured proxy', () => {
  const {OnRequest, onRequest} = loadOnRequest();
  OnRequest.init(getPref());
  const result = onRequest(getRequest());
  assert.equal(result.type, 'socks');
  assert.equal(result.host, 'proxy.example');
  assert.equal(result.port, 1080);
  assert.equal(result.proxyDNS, true);
});

test('routes an unmatched request directly', () => {
  const {OnRequest, onRequest} = loadOnRequest();
  OnRequest.init(getPref());

  assert.equal(onRequest(getRequest('https://example.com/')).type, 'direct');
});

test('routes a request directly when FoxyProxy is disabled', () => {
  const {OnRequest, onRequest} = loadOnRequest();
  OnRequest.init(getPref('disable'));

  assert.equal(onRequest(getRequest()).type, 'direct');
});
