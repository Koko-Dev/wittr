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

dbPromise.then(db => {
  let tx = db.transaction('people', 'readwrite');
  let peopleStore = tx.objectStore('people');
  
  // because keyPath is 'name' is the key, we only need the value
  peopleStore.put({
    name: 'Sam Munoz',
    age: 25,
    favoriteAnimal: 'cat'
  });
  
  peopleStore.put({
    name: 'DK Davic',
    age: 26,
    favoriteAnimal: 'cat'
  });
  
  peopleStore.put({
    name: 'JK Jordan',
    age: 27,
    favoriteAnimal: 'lizard'
  });
  
  peopleStore.put({
    name: 'CK Chelsey',
    age: 35,
    favoriteAnimal: 'koala'
  });
  
  peopleStore.put({
    name: 'BK Bree',
    age: 15,
    favoriteAnimal: 'dog'
  });
  
  return tx.complete;
}).then(() => {
  console.log('People added');
});

// To read the people in the people store
dbPromise.then(db => {
  let tx = db.transaction('people');
  let peopleStore = tx.objectStore('people');
  
  return peopleStore.getAll();
}).then(people => {
  console.log('People:', people);
});