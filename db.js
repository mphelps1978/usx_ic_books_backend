const { Sequelize } = require('sequelize')
require('dotenv').config()

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
})

const User = require('./models/User')(sequelize)
const Loads = require('./models/Loads')(sequelize)

User.hasMany(Loads, { foreignKey: 'userId' })
Loads.belongsTo(User, { foreignKey: 'userId' })

module.exports = { sequelize, User, Loads}