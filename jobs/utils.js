const db = require(`./db`);

const varGet = async (key) => {
  let res = await db.mongo.collection(`vars`).findOne({
    key: key,
  });
  
  return res;
};

module.exports = {
  varGet,
};
