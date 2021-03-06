import idb from 'idb';

let dbPromise = idb.open('test-db', 4, (upgradeDb) => {
  switch(upgradeDb.oldVersion) {
    case 0:
      let keyValStore = upgradeDb.createObjectStore('keyval');
      keyValStore.put("world", "hello");
    case 1:
      upgradeDb.createObjectStore('people', {keyPath: 'name'});
    case 2:
      let peopleStore = upgradeDb.transaction.objectStore('people');
      // Create an index called 'animal' which sorts by the favoriteAnimal property
      // To use this property, modify the code where I list all of the people
      peopleStore.createIndex('animal', 'favoriteAnimal');
    case 3:
      // TODO: create an index on 'people' named 'age', ordered by 'age'
      peopleStore = upgradeDb.transaction.objectStore('people');
      
      // add a new index called 'age' that sorts by the 'age' property
      peopleStore.createIndex('age', 'age');
      
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


// TODO: read the people in the people store
dbPromise.then(db => {
  let tx = db.transaction('people');
  let peopleStore = tx.objectStore('people');
  
  // after upgrading the people store to add an index called 'animal'
  // Get the index from the object store by name 'animal' and call getAll on the index
  let animalIndex = peopleStore.index('animal');
  
  // returns a Promise for all of the people in the store
  // return peopleStore.getAll();
  
  // Call getAll on the 'animal' index to sort by favoriteAnimal
  // return animalIndex.getAll();
  
  // Add a specific query -- Query 'cat'
  return animalIndex.getAll('cat');
}).then(people => {
  
  // The output will be the people sorted by their favoriteAnimal (alphabetized) instead of randomly
  // Query 'cat' -- This will log to the console only those people whose favoriteAnimal is 'cat'
  console.log('People:', people);
});


// TODO: console log all people ordered by age
dbPromise.then(db => {
  let tx = db.transaction('people');
  let peopleStore = tx.objectStore('people');
  let ageIndex = peopleStore.index('age');
  
  return ageIndex.getAll();
  
}).then(people => {
  console.log('People ordered by age: ', people);
}).catch(err => {
  console.log('Error sorting People by age:', err);
});


// TODO: console log all people ordered by age
dbPromise.then(db => {
  let tx = db.transaction('people');
  let peopleStore = tx.objectStore('people');
  let ageIndex = peopleStore.index('age');
  
  // Get all of the people sorted by age  (and then log people to the console)
  // return ageIndex.getAll();
  
  // Using Cursors, we can go through one item at a time rather than getting all of the people out of the store
  // Rather than calling getAll(), open a Cursor
  // This returns a Promise for a Cursor Object representing the first item in the index,
  //      or undefined if there isn't one
  return ageIndex.openCursor();
  
}).then(cursor => {
  if(!cursor) return;
  // To skip the first two items use cursor.advance(2)
  return cursor.advance(2);
  
  }).then(function logPerson(cursor) {
  // If it is undefined, just return
  if(!cursor) return;
  
  // Otherwise, log it
  // The first person in the index is in cursor.value
  console.log('Cursored at:', cursor.value.name);
  // To change the value use cursor.update(newValue)
  // To delete the entry, use cursor.delete()
  
  // Then call cursor.continue() to move on to the next item
  // cursor.continue() returns a Promise for a cursor representing the next item
  //        or it returns undefined if there isn't one
  // Then, Call function logPerson once cursor.continue resolves
  // This sets up an asynchronous loop until cursor is undefined  (end of list)
  return cursor.continue().then(logPerson);
  
  }).then(() => {
    console.log(('Done cursoring'));
  });



