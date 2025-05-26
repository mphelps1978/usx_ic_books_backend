const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const Load = sequelize.define('Load', {
    proNumber: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    dateDispatched: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    dateDelivered: {
      type: DataTypes.DATE,
    },
    trailerNumber: {
      type: DataTypes.STRING,
    },
    originCity: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    originState: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    destinationCity: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    destinationState: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    deadheadMiles: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    loadedMiles: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    weight: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    linehaul: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    fsc: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    calculatedGross: {
      type: DataTypes.FLOAT,
    },
    fuelCost: {
      type: DataTypes.FLOAT,
      defaultValue: 100, // Dummy value
    },
    scaleCost: {
      type: DataTypes.FLOAT,
      defaultValue: 50, // Dummy value
    },
    projectedNet: {
      type: DataTypes.FLOAT,
    },
    userId: {
      type: DataTypes.INTEGER,
      references: {
        model: 'Users',
        key: 'id',
      },
    },
  });

  return Load;
};