const Sequelize = require("sequelize")
const db = {}

const tableName = process.env.db_table_name;
const userName = process.env.db_username;
const password = process.env.db_password;
const host = process.env.db_host;
const port = process.env.db_port;
const dbDialect = process.env.db_dialect;

const sequelize = new Sequelize(tableName,userName,password,{
    host: host,
    port:port,
    dialect: dbDialect,
    operatorsAliases: false,

    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
})

// sequelize.authenticate().then(()=>{
//     console.log("message here")
// }).catch(err=>{
//     console.log("error :"+err)
// })
db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db