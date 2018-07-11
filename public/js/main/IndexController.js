import PostsView from './views/Posts';
import ToastsView from './views/Toasts';
import idb from 'idb';


function openDatabase() {
  // If the browser doesn't support service worker,
  // we don't care about having a database
  if(!navigator.serviceWorker) {
    return Promise.resolve();
  }
  
  // TODO: return a promise for a database called 'wittr'
  // that contains one objectStore: 'wittrs'
  // that uses 'id' as its key
  // and has an index called 'by-date',
  // which is sorted by the 'time' property
  return idb.open('wittr', 1, (upgradeDb) => {
    let witterStore = upgradeDb.createObjectStore('wittrs', {keyPath: 'id'});
    witterStore.createIndex('by-date', 'time');
  });
}


export default function IndexController(container) {
  this._container = container;
  this._postsView = new PostsView(this._container);
  this._toastsView = new ToastsView(this._container);
  this._lostConnectionToast = null;
  
  // Create a Promise for a database by calling openDatabase()
  this._dbPromise = openDatabase();
  this._registerServiceWorker();
  
  // When the page loads, it starts the Controller
  // So, in here, we call a new cleanImageCache method
  this._cleanImageCache();
  
  // For instant live posts, moved to _showCachedMessages() Promise
  // this._openSocket();
  
  let indexController = this;
  
  // Used to clean image cache
  // Since the image cache can still get out of control
  // if the user keeps the page open for a long time
  // We will also call the _cleanImageCache() method every 5 minutes
  setInterval(function() {
    indexController._cleanImageCache();
  }, 1000 * 60 * 5);
  
  
  this._showCachedMessages().then(function() {
    indexController._openSocket();
  });
}



IndexController.prototype._registerServiceWorker = function() {
  if (!navigator.serviceWorker) return;
  
  var indexController = this;
  
  navigator.serviceWorker.register('/sw.js').then(function(reg) {
    if (!navigator.serviceWorker.controller) {
      return;
    }
    
    if (reg.waiting) {
      indexController._updateReady(reg.waiting);
      return;
    }
    
    if (reg.installing) {
      indexController._trackInstalling(reg.installing);
      return;
    }
    
    reg.addEventListener('updatefound', function() {
      indexController._trackInstalling(reg.installing);
    });
  });
  
  // Ensure refresh is only called once.
  // This works around a bug in "force update on reload".
  var refreshing;
  navigator.serviceWorker.addEventListener('controllerchange', function() {
    if (refreshing) return;
    window.location.reload();
    refreshing = true;
  });
};



IndexController.prototype._showCachedMessages = function () {
  let indexController = this;
  
  return this._dbPromise.then(function(db) {
    // if we're already showing posts, eg shift-refresh
    // or the very first load, there's no point fetching
    // posts from IDB
    if(!db || indexController._postsView.showingPosts()) return;
    
    // TODO: get all of the wittr message objects from indexedDB
    // then pass them to:
    // indexController._postsView.addPosts(messages)
    // make sure messages are in date descending order
    // Remember to return a promise that does all this,
    // so the websocket isn't opened until you're done!
    // If Database gets into a bad state run in console
    // indexedDB.deleteDatabase('wittr')
    let timeIndex = db.transaction('wittrs').objectStore('wittrs').index('by-date');
    return timeIndex.getAll().then(messages => {
      // messages are in date ascending order by default
      indexController._postsView.addPosts(messages.reverse());
    });
  });
};


IndexController.prototype._trackInstalling = function(worker) {
  var indexController = this;
  worker.addEventListener('statechange', function() {
    if (worker.state == 'installed') {
      indexController._updateReady(worker);
    }
  });
};


IndexController.prototype._updateReady = function(worker) {
  var toast = this._toastsView.show("New version available", {
    buttons: ['refresh', 'dismiss']
  });
  
  toast.answer.then(function(answer) {
    if (answer != 'refresh') return;
    worker.postMessage({action: 'skipWaiting'});
  });
};



// open a connection to the server for live updates
IndexController.prototype._openSocket = function() {
  var indexController = this;
  var latestPostDate = this._postsView.getLatestPostDate();
  
  // create a url pointing to /updates with the ws protocol
  var socketUrl = new URL('/updates', window.location);
  socketUrl.protocol = 'ws';
  
  if (latestPostDate) {
    socketUrl.search = 'since=' + latestPostDate.valueOf();
  }
  
  // this is a little hack for the settings page's tests,
  // it isn't needed for Wittr
  socketUrl.search += '&' + location.search.slice(1);
  
  var ws = new WebSocket(socketUrl.href);
  
  // add listeners
  ws.addEventListener('open', function() {
    if (indexController._lostConnectionToast) {
      indexController._lostConnectionToast.hide();
    }
  });
  
  ws.addEventListener('message', function(event) {
    requestAnimationFrame(function() {
      indexController._onSocketMessage(event.data);
    });
  });
  
  ws.addEventListener('close', function() {
    // tell the user
    if (!indexController._lostConnectionToast) {
      indexController._lostConnectionToast = indexController._toastsView.show("Unable to connect. Retrying…");
    }
    
    // try and reconnect in 5 seconds
    setTimeout(function() {
      indexController._openSocket();
    }, 5000);
  });
};



// Used to clean images in cache
// Aim: Keeps current images from page in images cache and deletes the rest
// This brings in indexedDB and the Cache API
// In Dev Tools, we should only see the images cache only contains
//   images that are currently on the page
IndexController.prototype._cleanImageCache = function() {
  return this._dbPromise.then(db => {
    if (!db) return;                           
    
    // TODO: open the 'wittr' object store, get all the messages,
    // gather all the photo urls.
    
    // Create an empty array to store the images we want to keep
    let imagesNeeded = [];
    
    // Create a transaction to look at the wittrs objectStore
    let tx = db.transaction('wittrs');
    
    // Get the wittrs objectStore and all the messages
    return tx.objectStore('wittrs').getAll().then(messages => {
      // Now we can take a peek into the Database
      messages.forEach(message => {
        // for each message, check for photo property
        // message.photo contains the photo URL without the width bit at the end
        if(message.photo) {
          //if message has photo, then store in the array
          // These are the images that we want to keep
          imagesNeeded.push(message.photo);
        }
        // Needed later for caching avatar
        /*imagesNeeded.push(message.avatar);*/
      });
      // Open the 'wittr-content-imgs' cache,
      // Get all the requests that are stored in it using cache.keys()
      // and delete any entry
      // that we no longer need.
      
      return caches.open('wittr-content-imgs');
    }).then(cache => {
      // Get all of the Requests in the cache using cache.keys()
      // Requests == cache.keys()
      return cache.keys().then(requests => {
        // Go through each key/request of these photos
        requests.forEach(request => {
          // Each request has a URL property
          // Use new URL to get to the pathname property
          // The URLs on request objects are absolute,
          //   so they will include the localhost:8888 bit
          //   whereas the URLs we are storing in indexedDB do not have that
          // So for each request we are going to pass URL
          let url = new URL(request.url);
          // So, now if the pathname of the URL isn't in our array of imagesNeeded
          //     then pass request to caches.delete()  == caches.delete(request)
          // pathname property is the same as in cache/indexedDB
          if(!imagesNeeded.includes(url.pathname)) {
            // if not in array then delete
            cache.delete(request);
          }
        });
      });
    });
  });
};



// called when the web socket sends message data
// Here we add messages to the database
IndexController.prototype._onSocketMessage = function(data) {
  var messages = JSON.parse(data);
  
  // See live posts in console
  // console.log('Live Message: ', messages);
  
  // Add messages to the database once the database has been fetched
  this._dbPromise.then((db) => {
    if(!db) return;
    
    // TODO: put each message into the 'witters' object store
    let tx = db.transaction('wittrs', 'readwrite');
    let witterStore = tx.objectStore('wittrs');
    messages.forEach(message => {
      witterStore.put(message);
    });
    
    // TODO: keep the newest 30 entries in 'wittrs'
    // but delete the rest.
    //
    // Using .openCursor(null, 'prev') to
    // open a cursor that goes through an index/witterStore
    // backwards through the index starting with the newest post.
    witterStore.index('by-date').openCursor(null, 'prev').then(cursor => {
      
      // The first 30 newest posts can stay, so we advance past them
      return cursor.advance(30);
      
    }).then(function deleteRest(cursor) {
      
      // if cursor is undefined, we are done
      if(!cursor) return;
      
      // Delete data entry
      cursor.delete();
      return cursor.continue().then(deleteRest);
    });
  });
  
  this._postsView.addPosts(messages);
};