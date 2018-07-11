let staticCacheName = 'wittr-static-v9';
let contentImgsCache = 'wittr-content-imgs';
let allCaches = [
  staticCacheName,
  contentImgsCache
];


self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(staticCacheName).then(cache => {
      return cache.addAll([
        '/skeleton',
        'js/main.js',
        'css/main.css',
        'imgs/icon.png',
        'https://fonts.gstatic.com/s/roboto/v15/2UX7WLTfW3W8TclTUvlFyQ.woff',
        'https://fonts.gstatic.com/s/roboto/v15/d-6IYplOFocCacKzxwXSOD8E0i7KZn-EPnyo3HZu7kw.woff'
      ]);
    })
  );
});


//  In this activate event, we're deleting any cache that isn't the static cache
//  This will not work anymore as we start losing our image cache
//  Rewritten below, but will keep this for reference
/*self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName.startsWith('wittr-') &&
            cacheName != staticCacheName;
        }).map(cacheName =>  {
          return caches.delete(cacheName);
        })
      );
    })
  );
});*/

// Delete any caches that aren't in allCaches Array
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.filter(cacheName => {
          return cacheName.startsWith('wittr-') && !allCaches.includes(cacheName);
        }).map(cacheName => {
          return caches.delete(cacheName);
        })
      );
    })
  );
});


self.addEventListener('fetch', event => {
  let requestUrl = new URL(event.request.url);
  
  if (requestUrl.origin === location.origin) {
    if (requestUrl.pathname === '/') {
      event.respondWith(caches.match('/skeleton'));
      return;
    }
    
    // Handling photo requests
    // Handle fetch events that have the same origin
    // and have a path that starts with '/photo/'
    if(requestUrl.pathname.startsWith('/photos/')) {
      // servePhoto returns one copy of each photo
      event.respondWith(servePhoto(event.request));
      return;
    }
  }
  
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});



function servePhoto(request) {
  // The 'request' parameter is the '/photo/' URL from the fetch listener
  // Photo urls look like the following with the width information at the end:
  // /photos/9-8028-7527734776-e1d2bda28e-800px.jpg
  // In storageUrl has the -800px.jpg we replace the size info with nothing ('').
  // We use this url to store & match the image in the cache.
  // This means we only store one copy of each photo and don't care about the size.
  let storageUrl = request.url.replace(/-\d+px\.jpg$/, '');
  
  // TODO: return images from the "wittr-content-imgs" cache
  // if they're in there. Otherwise, fetch the images from
  // the network, put them into the cache, and send it back
  // to the browser.
  //
  // HINT: cache.put supports a plain url as the first parameter
  
  // Open image cache
  return caches.open(contentImgsCache).then(cache => {
    // Once we have the cache, we look for a match from cache
    // If there is a match, we return it, otherwise fetch from the Network
    return cache.match(storageUrl).then(response => {
      if(response) return response;
      
      // No cache match for photo url,
      // so we fetch the image from the Network and store
      // the response's clone (the specific image requested by the browser) in the cache
      // for offline first capabilities
      // while at the same time returning the network's image response to the page
      // The clone is used because you can only read a response's body ONCE
      // Note: The browser receives the response with size information,
      // but we store the image in wittr-content-imgs cache without the size info..
      // It could be of any size.
      // When offline, for the sake of bandwidth, we don't care if the photo is of browser requested size.
      return fetch(request).then(networkResponse => {
        cache.put(storageUrl, networkResponse.clone());
        return networkResponse;
      });
      
    });
  });
}



self.addEventListener('message', event => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});