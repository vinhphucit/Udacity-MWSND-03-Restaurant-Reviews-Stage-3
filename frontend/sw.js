let version = '1.3.0';
let staticCacheName = 'restaurant-static-v3';
let dbPromiseVar;
if ('serviceWorker' in navigator) {
  console.log("serviceWorker in navigator");
  navigator.serviceWorker.register('sw.js').then(registration => {
    // Registration was successful
    console.log('ServiceWorker registration successful with scope: ', registration.scope);
  }, err => {
    // registration failed :(
    console.log('ServiceWorker registration failed: ', err);
  });

  navigator.serviceWorker.ready.then(function (swRegistration) {
    return swRegistration.sync.register('myFirstSync');
  });
}


self.addEventListener('sync', function (event) {
  console.log("START SYNCING");
  if (event.tag === 'myFirstSync') {
    event.waitUntil(
      sendReviews().then(() => {
      }).catch(err => {
        console.log(err);
      })
    );
    event.waitUntil(
      sendFavorites().then(() => {
      }).catch(err => {
        console.log(err);
      })
    );
  }
});

self.addEventListener('activate', event => {
  event.waitUntil((function () {
    self.clients.claim();
    dbPromise();
  })());
});


function dbPromise() {
  let DBName = 'restaurant';
  let DBVersion = 1;

  if (!dbPromiseVar)
    dbPromiseVar = idb.open(DBName, DBVersion, function (upgradeDb) {
      if (!upgradeDb.objectStoreNames.contains('restaurants')) {
        upgradeDb.createObjectStore('restaurants', { keyPath: 'id' });
        var reviewstore = upgradeDb.createObjectStore('reviews', { keyPath: 'id' });
        reviewstore.createIndex('restaurant_id', 'restaurant_id');
        upgradeDb.createObjectStore('favoriteoutbox', { keyPath: 'id' });
        upgradeDb.createObjectStore('reviewoutbox', { keyPath: 'updatedAt' });
      }
    });
  return dbPromiseVar;

}



self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(staticCacheName).then(function (cache) {
      return cache.addAll([
        '/',
        'index.html',
        'restaurant.html',
        'css/styles.css',
        'js/dbhelper.js',
        'js/main.js',
        'js/restaurant_info.js',
        'sw.js',
        'js/idb.js',
        'img/1.jpg', 'img/1-480.jpg',
        'img/2.jpg', 'img/2-480.jpg',
        'img/3.jpg', 'img/3-480.jpg',
        'img/4.jpg', 'img/4-480.jpg',
        'img/5.jpg', 'img/5-480.jpg',
        'img/6.jpg', 'img/6-480.jpg',
        'img/7.jpg', 'img/7-480.jpg',
        'img/8.jpg', 'img/8-480.jpg',
        'img/9.jpg', 'img/9-480.jpg',
        'img/10.jpg', 'img/10-480.jpg'
      ]);
    })
  );
});


self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (cacheNames) {
      return Promise.all(
        cacheNames.filter(function (cacheName) {
          return cacheName.startsWith('restaurant-') && cacheName != staticCacheName;
        }).map(function (cacheName) {
          return caches.delete(cacheName);
        })
      );
    })
  );
});


self.addEventListener('fetch', function (event) {
  var requestUrl = new URL(event.request.url);

  if (requestUrl.pathname.startsWith('/restaurant.html')) {
    event.respondWith(serveRestaurantDetail(event.request));
    return;
  }

  if (event.request.url.endsWith('localhost:1337/restaurants')) {
    event.respondWith(
      dbPromise().then(function (db) {
        var tx = db.transaction('restaurants', 'readonly');
        var store = tx.objectStore('restaurants');
        return store.getAll();
      }).then(function (items) {
        if (!items.length) {
          return fetch(event.request).then(function (response) {
            return response.clone().json().then(json => {
              saveAllRestaurants(json);
              return response;
            })
          });
        } else {
          let response = new Response(JSON.stringify(items), {
            headers: new Headers({
              'Content-type': 'application/json',
              'Access-Control-Allow-Credentials': 'true'
            }),
            type: 'cors',
            status: 200
          });
          return response;
        }
      })
    );

    return;
  }


  event.respondWith(
    caches.match(event.request).then(function (response) {

      if (response) {
        return response;
      }
      return fetch(event.request)
        .then(function (response) {
          return caches.open(staticCacheName).then(function (cache) {
            //never cache data from google map
            if (event.request.url.indexOf('maps') < 0 && !event.request.url.includes('localhost:1337')) {
              cache.put(event.request.url, response.clone());
            }
            return response;
          });
        });

    }).catch(function (error) {
      console.log(error);
    })
  );
});

function serveRestaurantDetail(request) {
  return caches.open(staticCacheName).then(function (cache) {
    return cache.match('/restaurant.html').then(function (response) {
      if (response) return response;

      return fetch(request).then(function (networkResponse) {
        cache.put(request, networkResponse.clone());
        return networkResponse;
      });
    });
  });
}


function saveAllRestaurants(rlist) {
  let tx;
  dbPromise().then(function (db) {
    tx = db.transaction('restaurants', 'readwrite');
    var store = tx.objectStore('restaurants');
    rlist.forEach(function (res) {
      console.log('adding', res);
      store.put(res);
    });
    return tx.complete;
  }).then(function () {
  }).catch(function (err) {
    tx.abort();
    return false;
  });
}




function sendFavorites() {
  return dbPromise().then(db => {
    let tx = db.transaction('favoriteoutbox', 'readonly');
    return tx.objectStore('favoriteoutbox').getAll();
  }).then(items => {
    return Promise.all(items.map(item => {
      let id = item.id;
      let is_favorite = (item.favorite === 'true')
      // delete review.id;
      console.log("sending favorite", item);
      // POST review
      return fetch(`http://localhost:1337/restaurants/${id}/?is_favorite=${is_favorite}`, {
        method: 'PUT'
      }).then(response => {
        console.log(response);
        return response.json();
      }).then(data => {
        console.log('added favorite', data);
        if (data) {
          // delete from db
          dbPromise().then(db => {
            let tx = db.transaction('favoriteoutbox', 'readwrite');
            return tx.objectStore('favoriteoutbox').delete(id);
          });
        }
      });
    }));
  });
}

function sendReviews() {
  return dbPromise().then(db => {
    let tx = db.transaction('reviewoutbox', 'readonly');
    return tx.objectStore('reviewoutbox').getAll();
  }).then(reviews => {
    return Promise.all(reviews.map(review => {
      console.log("sending review", review);
      // POST review
      return fetch('http://localhost:1337/reviews', {
        method: 'POST',
        body: JSON.stringify(review),
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      }).then(response => {
        console.log(response);
        return response.json();
      }).then(data => {
        console.log('added review', data);
        if (data) {
          // delete from db
          dbPromise().then(db => {
            const reviewstx = db.transaction('reviews', 'readwrite');
            const reviewsstore = reviewstx.objectStore('reviews');
            reviewsstore.put(data);

            let tx = db.transaction('reviewoutbox', 'readwrite');
            return tx.objectStore('reviewoutbox').delete(review.updatedAt);
          });
        }
      });
    }));
  });
}

'use strict';

(function () {
  function toArray(arr) {
    return Array.prototype.slice.call(arr);
  }

  function promisifyRequest(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () {
        resolve(request.result);
      };

      request.onerror = function () {
        reject(request.error);
      };
    });
  }

  function promisifyRequestCall(obj, method, args) {
    var request;
    var p = new Promise(function (resolve, reject) {
      request = obj[method].apply(obj, args);
      promisifyRequest(request).then(resolve, reject);
    });

    p.request = request;
    return p;
  }

  function promisifyCursorRequestCall(obj, method, args) {
    var p = promisifyRequestCall(obj, method, args);
    return p.then(function (value) {
      if (!value) return;
      return new Cursor(value, p.request);
    });
  }

  function proxyProperties(ProxyClass, targetProp, properties) {
    properties.forEach(function (prop) {
      Object.defineProperty(ProxyClass.prototype, prop, {
        get: function () {
          return this[targetProp][prop];
        },
        set: function (val) {
          this[targetProp][prop] = val;
        }
      });
    });
  }

  function proxyRequestMethods(ProxyClass, targetProp, Constructor, properties) {
    properties.forEach(function (prop) {
      if (!(prop in Constructor.prototype)) return;
      ProxyClass.prototype[prop] = function () {
        return promisifyRequestCall(this[targetProp], prop, arguments);
      };
    });
  }

  function proxyMethods(ProxyClass, targetProp, Constructor, properties) {
    properties.forEach(function (prop) {
      if (!(prop in Constructor.prototype)) return;
      ProxyClass.prototype[prop] = function () {
        return this[targetProp][prop].apply(this[targetProp], arguments);
      };
    });
  }

  function proxyCursorRequestMethods(ProxyClass, targetProp, Constructor, properties) {
    properties.forEach(function (prop) {
      if (!(prop in Constructor.prototype)) return;
      ProxyClass.prototype[prop] = function () {
        return promisifyCursorRequestCall(this[targetProp], prop, arguments);
      };
    });
  }

  function Index(index) {
    this._index = index;
  }

  proxyProperties(Index, '_index', [
    'name',
    'keyPath',
    'multiEntry',
    'unique'
  ]);

  proxyRequestMethods(Index, '_index', IDBIndex, [
    'get',
    'getKey',
    'getAll',
    'getAllKeys',
    'count'
  ]);

  proxyCursorRequestMethods(Index, '_index', IDBIndex, [
    'openCursor',
    'openKeyCursor'
  ]);

  function Cursor(cursor, request) {
    this._cursor = cursor;
    this._request = request;
  }

  proxyProperties(Cursor, '_cursor', [
    'direction',
    'key',
    'primaryKey',
    'value'
  ]);

  proxyRequestMethods(Cursor, '_cursor', IDBCursor, [
    'update',
    'delete'
  ]);

  // proxy 'next' methods
  ['advance', 'continue', 'continuePrimaryKey'].forEach(function (methodName) {
    if (!(methodName in IDBCursor.prototype)) return;
    Cursor.prototype[methodName] = function () {
      var cursor = this;
      var args = arguments;
      return Promise.resolve().then(function () {
        cursor._cursor[methodName].apply(cursor._cursor, args);
        return promisifyRequest(cursor._request).then(function (value) {
          if (!value) return;
          return new Cursor(value, cursor._request);
        });
      });
    };
  });

  function ObjectStore(store) {
    this._store = store;
  }

  ObjectStore.prototype.createIndex = function () {
    return new Index(this._store.createIndex.apply(this._store, arguments));
  };

  ObjectStore.prototype.index = function () {
    return new Index(this._store.index.apply(this._store, arguments));
  };

  proxyProperties(ObjectStore, '_store', [
    'name',
    'keyPath',
    'indexNames',
    'autoIncrement'
  ]);

  proxyRequestMethods(ObjectStore, '_store', IDBObjectStore, [
    'put',
    'add',
    'delete',
    'clear',
    'get',
    'getAll',
    'getKey',
    'getAllKeys',
    'count'
  ]);

  proxyCursorRequestMethods(ObjectStore, '_store', IDBObjectStore, [
    'openCursor',
    'openKeyCursor'
  ]);

  proxyMethods(ObjectStore, '_store', IDBObjectStore, [
    'deleteIndex'
  ]);

  function Transaction(idbTransaction) {
    this._tx = idbTransaction;
    this.complete = new Promise(function (resolve, reject) {
      idbTransaction.oncomplete = function () {
        resolve();
      };
      idbTransaction.onerror = function () {
        reject(idbTransaction.error);
      };
      idbTransaction.onabort = function () {
        reject(idbTransaction.error);
      };
    });
  }

  Transaction.prototype.objectStore = function () {
    return new ObjectStore(this._tx.objectStore.apply(this._tx, arguments));
  };

  proxyProperties(Transaction, '_tx', [
    'objectStoreNames',
    'mode'
  ]);

  proxyMethods(Transaction, '_tx', IDBTransaction, [
    'abort'
  ]);

  function UpgradeDB(db, oldVersion, transaction) {
    this._db = db;
    this.oldVersion = oldVersion;
    this.transaction = new Transaction(transaction);
  }

  UpgradeDB.prototype.createObjectStore = function () {
    return new ObjectStore(this._db.createObjectStore.apply(this._db, arguments));
  };

  proxyProperties(UpgradeDB, '_db', [
    'name',
    'version',
    'objectStoreNames'
  ]);

  proxyMethods(UpgradeDB, '_db', IDBDatabase, [
    'deleteObjectStore',
    'close'
  ]);

  function DB(db) {
    this._db = db;
  }

  DB.prototype.transaction = function () {
    return new Transaction(this._db.transaction.apply(this._db, arguments));
  };

  proxyProperties(DB, '_db', [
    'name',
    'version',
    'objectStoreNames'
  ]);

  proxyMethods(DB, '_db', IDBDatabase, [
    'close'
  ]);

  // Add cursor iterators
  // TODO: remove this once browsers do the right thing with promises
  ['openCursor', 'openKeyCursor'].forEach(function (funcName) {
    [ObjectStore, Index].forEach(function (Constructor) {
      Constructor.prototype[funcName.replace('open', 'iterate')] = function () {
        var args = toArray(arguments);
        var callback = args[args.length - 1];
        var nativeObject = this._store || this._index;
        var request = nativeObject[funcName].apply(nativeObject, args.slice(0, -1));
        request.onsuccess = function () {
          callback(request.result);
        };
      };
    });
  });

  // polyfill getAll
  [Index, ObjectStore].forEach(function (Constructor) {
    if (Constructor.prototype.getAll) return;
    Constructor.prototype.getAll = function (query, count) {
      var instance = this;
      var items = [];

      return new Promise(function (resolve) {
        instance.iterateCursor(query, function (cursor) {
          if (!cursor) {
            resolve(items);
            return;
          }
          items.push(cursor.value);

          if (count !== undefined && items.length == count) {
            resolve(items);
            return;
          }
          cursor.continue();
        });
      });
    };
  });

  var exp = {
    open: function (name, version, upgradeCallback) {
      var p = promisifyRequestCall(indexedDB, 'open', [name, version]);
      var request = p.request;

      request.onupgradeneeded = function (event) {
        if (upgradeCallback) {
          upgradeCallback(new UpgradeDB(request.result, event.oldVersion, request.transaction));
        }
      };

      return p.then(function (db) {
        return new DB(db);
      });
    },
    delete: function (name) {
      return promisifyRequestCall(indexedDB, 'deleteDatabase', [name]);
    }
  };

  if (typeof module !== 'undefined') {
    module.exports = exp;
    module.exports.default = module.exports;
  }
  else {
    self.idb = exp;
  }
}());
