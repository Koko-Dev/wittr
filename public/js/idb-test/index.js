import idb from 'idb';

let dbPromise = idb.open('test-db', 2, (upgradeDb) => {
  switch(upgradeDb.oldVersion) {
    case 0:
      let keyValStore = upgradeDb.createObjectStore('keyval');
      keyValStore.put("world", "hello");
    case 1:
      upgradeDb.createObjectStore('people', {keyPath: 'name'});
  }
  
  
});

// read "hello" in "keyval"
dbPromise.then(function(db) {
  let tx = db.transaction('keyval');
  let keyValStore = tx.objectStore('keyval');
  return keyValStore.get('hello');
}).then(function(val) {
  console.log('The value of "hello" is:', val);
});

// set "foo" to be "bar" in "keyval"
dbPromise.then(function(db) {
  let tx = db.transaction('keyval', 'readwrite');
  let keyValStore = tx.objectStore('keyval');
  keyValStore.put('bar', 'foo');
  return tx.complete;
}).then(function() {
  console.log('Added foo:bar to keyval');
});

dbPromise.then(db => {
  // TODO: in the keyval store, set
  // "favoriteAnimal" to your favourite animal
  // eg "cat" or "dog"
  let tx = db.transaction('keyval', 'readwrite');
  let keyValStore = tx.objectStore('keyval');
  keyValStore.put("dog", "favoriteAnimal");
  return tx.complete;
}).then(function() {
  console.log('Added favoriteAnimal: dog');
  
});