// db.js
const { Sequelize } = require('sequelize');
require('dotenv').config();

const sequelize = new Sequelize(process.env.DATABASE_URL, {
  dialect: 'postgres',
  logging: console.log, // Enable Sequelize logging to see what it's doing
});

sequelize.authenticate()
  .then(() => console.log('Database connected'))
  .catch((err) => {
    console.error('!!! Connection error:', err); // More prominent error
    process.exit(1); // Exit if DB connection fails
  });

let User, Loads, FuelStops; // Define them here

try {
  User = require('./models/User')(sequelize);
  Loads = require('./models/Loads')(sequelize);     // Ensure path is './models/Loads.js'
  FuelStops = require('./models/FuelStops')(sequelize); // Ensure path is './models/FuelStops.js'

  console.log('User model loaded:', !!User);
  console.log('Loads model loaded:', !!Loads);
  console.log('FuelStops model loaded:', !!FuelStops);

  if (!User || !Loads || !FuelStops) {
    throw new Error('One or more models failed to load!');
  }

  // --- Define associations DIRECTLY and SIMPLY ---
  // User and Loads
  if (User && Loads) {
    User.hasMany(Loads, { foreignKey: 'userId', as: 'loads' }); // Added alias
    Loads.belongsTo(User, { foreignKey: 'userId', as: 'user' }); // Added alias
    console.log('User <-> Loads associations defined.');
  } else {
    console.error('User or Loads model is undefined. Cannot define User <-> Loads association.');
  }

  // Loads and FuelStops
  if (Loads && FuelStops) {
    Loads.hasMany(FuelStops, { foreignKey: 'proNumber', sourceKey: 'proNumber', as: 'fuelStops' });
    FuelStops.belongsTo(Loads, { foreignKey: 'proNumber', targetKey: 'proNumber', as: 'load' });
    console.log('Loads <-> FuelStops associations defined.');
  } else {
    console.error('Loads or FuelStops model is undefined. Cannot define Loads <-> FuelStops association.');
  }

  // User and FuelStops
  if (User && FuelStops) {
    User.hasMany(FuelStops, { foreignKey: 'userId', as: 'userFuelStops' }); // Added alias
    FuelStops.belongsTo(User, { foreignKey: 'userId', as: 'user' });
    console.log('User <-> FuelStops associations defined.');
  } else {
    console.error('User or FuelStops model is undefined. Cannot define User <-> FuelStops association.');
  }

} catch (modelError) {
  console.error('!!! Error loading or associating models:', modelError);
  process.exit(1); // Exit if model loading/association fails
}


// // Call associate methods if they exist on the models (COMMENTED OUT)
// const models = { User, Loads, FuelStops };
// Object.values(models)
//   .filter(model => typeof model.associate === 'function')
//   .forEach(model => model.associate(models));


sequelize.sync({ alter: true })
  .then(() => console.log('Tables synced'))
  .catch((err) => {
    console.error('!!! Sync error:', err);
    process.exit(1); // Exit on sync error
  });

module.exports = { sequelize, User, Loads, FuelStops };