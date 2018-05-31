
let Obj = {};

var MongoDB = require('mongodb');
var ObjectId = require('mongodb').ObjectID;
var MongoClient = MongoDB.MongoClient;

var url = 'mongodb://localhost:27017';

Obj.mongo = null;

Obj.init = async () => {
  try {
    let client = await MongoClient.connect(url, {
      //keepAlive: 30000,
      connectTimeoutMS: 60000 * 6,
      socketTimeoutMS: 60000 * 6,
    });

    console.log(`[mongo] connected!`);

    Obj.mongo = {
      ObjectId: ObjectId,
      collection: (colName) => {
        return client.db(`dninja`).collection(colName);
      },
    };

  } catch (err) {
    log(`mongodb caugh ERR:`);
    log(err);

    process.exit(1);
  }
};

module.exports = Obj;
