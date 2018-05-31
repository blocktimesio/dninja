let Obj = {};

const MongoDB = require(`mongodb`);
const ObjectId = MongoDB.ObjectID;
const MongoClient = MongoDB.MongoClient;

const url = `mongodb://${process.env.DB_HOST}:27017`;

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
        return client.db(process.env.DB_DATABASE).collection(colName);
      },
    };

  } catch (err) {
    log(`mongodb caught ERR:`);
    log(err);

    process.exit(1);
  }
};

module.exports = Obj;
