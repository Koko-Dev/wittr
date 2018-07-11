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
  
  
  // this._openSocket();
  let indexController = this;
  
  
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
      indexController._postsView.addPosts(messages.reverse());
    })
  })
}

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

// called when the web socket sends message data
// Here we add messages to the database
IndexController.prototype._onSocketMessage = function(data) {
  var messages = JSON.parse(data);
  
  // See live posts in console
  // console.log('Live Message: ', messages);
  
  // Add messages to the database once the database has been fetched
  this._dbPromise.then(db => {
    if(!db) return;
    
    // TODO: put each message into the 'witters' object store
    let tx = db.transaction('wittrs', 'readwrite');
    let witterStore = tx.objectStore('wittrs');
    let timeIndex = witterStore.index('by-date');
    
    messages.forEach(message => {
      witterStore.put(message);
    });
  });
  
  this._postsView.addPosts(messages);
};