// models/Loads.js
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Loads = sequelize.define('Loads', {
    proNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
    userId: { type: DataTypes.INTEGER, allowNull: false },
    dateDispatched: { type: DataTypes.DATE, allowNull: false },
    dateDelivered: { type: DataTypes.DATE, allowNull: true },
    trailerNumber: { type: DataTypes.STRING, allowNull: true },
    originCity: { type: DataTypes.STRING, allowNull: false },
    originState: { type: DataTypes.STRING, allowNull: false },
    destinationCity: { type: DataTypes.STRING, allowNull: false },
    destinationState: { type: DataTypes.STRING, allowNull: false },
    deadheadMiles: { type: DataTypes.FLOAT, allowNull: false },
    loadedMiles: { type: DataTypes.FLOAT, allowNull: false },
    weight: { type: DataTypes.FLOAT, allowNull: false },
    linehaul: { type: DataTypes.FLOAT, allowNull: false },
    fsc: { type: DataTypes.FLOAT, allowNull: false },
    calculatedGross: { type: DataTypes.FLOAT, allowNull: false },
    fuelCost: { type: DataTypes.FLOAT, allowNull: false },
    scaleCost: { type: DataTypes.FLOAT, allowNull: false },
    projectedNet: { type: DataTypes.FLOAT, allowNull: false },
  }, {
    timestamps: true,
  });

  Loads.associate = (models) => {
    Loads.hasMany(models.FuelStops, {
      foreignKey: 'proNumber',
      sourceKey: 'proNumber',
      as: 'fuelStops'
    });
    Loads.belongsTo(models.Users, {
      foreignKey: 'userId',
      as: 'user'
    });
  };

  return Loads;
};