const Sequelize = require("sequelize")
const db = {}
const sequelize = new Sequelize("fyp_primary_school_management","root","password",{
    host: 'localhost',
    port:'3306',
    dialect: 'mysql',
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