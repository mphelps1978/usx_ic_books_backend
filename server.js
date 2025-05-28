// server.js
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { User, Loads, FuelStops } = require('./db');
require('dotenv').config();

const app = express();

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// Authentication middleware
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    console.log('No token provided'); // Debug
    return res.status(401).json({ message: 'No token provided' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Token validated, userId:', decoded.userId); // Debug
    req.userId = decoded.userId;
    next();
  } catch (err) {
    console.error('Invalid token:', err.message); // Debug
    res.status(401).json({ message: 'Invalid token' });
  }
};

console.log('FuelStops model in server.js:', FuelStops);

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const user = await User.create({ username, email, password });
    res.status(201).json({ message: 'User registered', userId: user.id });
  } catch (err) {
    console.error('Register error:', err);
    res.status(400).json({ message: 'Registration failed' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user || user.password !== password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get Loads
app.get('/api/loads', authenticate, async (req, res) => {
  try {
    console.log('Fetching loads for user:', req.userId);
    const loads = await Loads.findAll({ where: { userId: req.userId } });
    res.json(loads);
  } catch (err) {
    console.error('Error fetching loads:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create Load
app.post('/api/loads', authenticate, async (req, res) => {
  try {
    const loadData = { ...req.body, userId: req.userId };
    loadData.dateDelivered = loadData.dateDelivered &&
      loadData.dateDelivered !== 'Invalid date' &&
      !isNaN(new Date(loadData.dateDelivered).getTime())
      ? new Date(loadData.dateDelivered)
      : null;
    const requiredFields = ['proNumber', 'dateDispatched', 'originCity', 'originState',
      'destinationCity', 'destinationState', 'deadheadMiles', 'loadedMiles', 'weight',
      'linehaul', 'fsc'];
    for (const field of requiredFields) {
      if (loadData[field] === undefined || loadData[field] === null) {
        return res.status(400).json({ message: `Missing required field: ${field}` });
      }
    }
    loadData.calculatedGross = (loadData.linehaul * 0.68) + loadData.fsc;
    loadData.fuelCost = loadData.fuelCost || 100;
    loadData.scaleCost = loadData.scaleCost || 50;
    loadData.projectedNet = loadData.calculatedGross - (loadData.fuelCost + loadData.scaleCost);
    console.log('Creating load:', loadData);
    const load = await Loads.create(loadData);
    res.status(201).json(load);
  } catch (err) {
    console.error('Error creating load:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update Load
app.put('/api/loads/:proNumber', authenticate, async (req, res) => {
  try {
    const load = await Loads.findOne({
      where: { proNumber: req.params.proNumber, userId: req.userId },
    });
    if (!load) return res.status(404).json({ message: 'Load not found' });
    const loadData = { ...req.body };
    loadData.dateDelivered = loadData.dateDelivered &&
      loadData.dateDelivered !== 'Invalid date' &&
      !isNaN(new Date(loadData.dateDelivered).getTime())
      ? new Date(loadData.dateDelivered)
      : null;
    loadData.calculatedGross = (loadData.linehaul * 0.68) + loadData.fsc;
    loadData.fuelCost = loadData.fuelCost || 100;
    loadData.scaleCost = loadData.scaleCost || 50;
    loadData.projectedNet = loadData.calculatedGross - (loadData.fuelCost + loadData.scaleCost);
    await load.update(loadData);
    res.json(load);
  } catch (err) {
    console.error('Error updating load:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Complete Load
app.put('/api/loads/:proNumber/complete', authenticate, async (req, res) => {
  try {
    const load = await Loads.findOne({
      where: { proNumber: req.params.proNumber, userId: req.userId },
    });
    if (!load) return res.status(404).json({ message: 'Load not found' });
    if (load.dateDelivered) {
      return res.status(400).json({ message: 'Load already completed' });
    }
    load.dateDelivered = new Date();
    await load.save();
    console.log('Completed load:', load.proNumber);
    res.json(load);
  } catch (err) {
    console.error('Error completing load:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Fuel Stop Routes
// ------------------------------------------------------------------------------------

// Create Fuel Stop
app.post('/api/fuelstops', authenticate, async (req, res) => {
  try {
    const {
      proNumber,
      dateOfStop,
      vendorName,
      location,
      gallonsDieselPurchased,
      pumpPriceDiesel,
      gallonsDefPurchased,
      pumpPriceDef,
    } = req.body;

    const requiredFields = ['proNumber', 'dateOfStop', 'vendorName', 'location', 'gallonsDieselPurchased', 'pumpPriceDiesel'];
    for (const field of requiredFields) {
      if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
        return res.status(400).json({ message: `Missing required field: ${field}` });
      }
    }
    const load = await Loads.findOne({ where: { proNumber, userId: req.userId } });
    if (!load) {
      return res.status(404).json({ message: 'Associated load not found or access denied.' });
    }

    const gdp = parseFloat(gallonsDieselPurchased);
    const ppd = parseFloat(pumpPriceDiesel);
    const costDieselPurchased = (ppd - 0.05) * gdp;

    let costDef = 0;
    if (gallonsDefPurchased && pumpPriceDef) {
      const gdefp = parseFloat(gallonsDefPurchased);
      const ppdef = parseFloat(pumpPriceDef);
      if (gdefp > 0 && ppdef > 0) {
        totalDefCost = ppdef * gdefp;
      }
    }
    const totalFuelStopCost = costDieselPurchased + totalDefCost;

    const fuelStopData = {
      proNumber,
      userId: req.userId,
      dateOfStop: req.body.dateOfStop,
      vendor: req.body.vendor,
      location: req.body.location,
      gallonsDieselPurchased: gdp,
      pumpPriceDiesel: ppd,
      costDieselPurchased: costDieselPurchased.toFixed(2),
      gallonsDefPurchased: gallonsDefPurchased ? parseFloat(gallonsDefPurchased) : null,
      pumpPriceDef: pumpPriceDef ? parseFloat(pumpPriceDef) : null,
      totalDefCost: totalDefCost.toFixed(2),
      totalFuelStopCost: totalFuelStopCost.toFixed(2),
    };

    const fuelStop = await FuelStops.create(fuelStopData);
    res.status(201).json(fuelStop);
  } catch (err) {
    console.error('Error creating fuel stop:', err);
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ message: 'Validation failed', errors: err.errors.map(e => e.message) });
    }
    res.status(500).json({ message: 'Server error while creating fuel stop' });
  }
});

// Get Fuel Stops (for the authenticated user, optionally filtered by proNumber)
app.get('/api/fuelstops', authenticate, async (req, res) => {
  try {
    const { proNumber } = req.query; // Optional query parameter to filter by load
    const whereClause = { userId: req.userId };
    if (proNumber) {
      whereClause.proNumber = proNumber;
    }
    const fuelStops = await FuelStops.findAll({
      where: whereClause,
      include: [{ model: Loads, as: 'load', attributes: ['proNumber', 'originCity', 'destinationCity'] }], // Include some Load info
      order: [['dateOfStop', 'DESC']], // Show newest first
    });
    res.json(fuelStops);
  } catch (err) {
    console.error('Error fetching fuel stops:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get a single Fuel Stop by ID (Optional - more common to fetch by user & load)
// If you need this, ensure your fuel stops have a unique ID accessible.
// app.get('/api/fuelstops/:id', authenticate, async (req, res) => {
//   try {
//     const fuelStop = await FuelStop.findOne({
//       where: { id: req.params.id, userId: req.userId },
//       include: [{ model: Loads, as: 'load' }]
//     });
//     if (!fuelStop) return res.status(404).json({ message: 'Fuel stop not found' });
//     res.json(fuelStop);
//   } catch (err) {
//     console.error('Error fetching fuel stop:', err);
//     res.status(500).json({ message: 'Server error' });
//   }
// });


// Update Fuel Stop
app.put('/api/fuelstops/:id', authenticate, async (req, res) => {
  try {
    const fuelStopId = req.params.id;
    const fuelStop = await FuelStops.findOne({ where: { id: fuelStopId, userId: req.userId } });

    if (!fuelStop) {
      return res.status(404).json({ message: 'Fuel stop not found or access denied' });
    }

    const {
      dateOfStop,
      vendorName,
      location,
      gallonsDieselPurchased,
      pumpPriceDiesel,
      gallonsDefPurchased,
      pumpPriceDef,
    } = req.body;

    const requiredFields = ['dateOfStop', 'vendorName', 'location', 'gallonsDieselPurchased', 'pumpPriceDiesel'];
    for (const field of requiredFields) {
      if (req.body[field] === undefined || req.body[field] === null || req.body[field] === '') {
        if (Object.prototype.hasOwnProperty.call(req.body, field)) {
          return res.status(400).json({ message: `Missing required field for update: ${field}` });
        }
      }
    }

    const gdp = parseFloat(gallonsDieselPurchased || fuelStop.gallonsDieselPurchased);
    const ppd = parseFloat(pumpPriceDiesel || fuelStop.pumpPriceDiesel);
    const costDieselPurchased = (ppd - 0.05) * gdp;

    let costDef = 0;
    const currentGallonsDef = gallonsDefPurchased !== undefined ? gallonsDefPurchased : fuelStop.gallonsDefPurchased;
    const currentPumpPriceDef = pumpPriceDef !== undefined ? pumpPriceDef : fuelStop.pumpPriceDef;

    if (currentGallonsDef && currentPumpPriceDef) {
      const gdefp = parseFloat(currentGallonsDef);
      const ppdef = parseFloat(currentPumpPriceDef);
      if (gdefp > 0 && ppdef > 0) {
        costDef = ppdef * gdefp;
      }
    }
    const totalFuelStopCost = costDieselPurchased + costDef;

    const updateData = { ...req.body };
    updateData.costDieselPurchased = costDieselPurchased.toFixed(2);
    if (gallonsDefPurchased !== undefined) {
      updateData.gallonsDefPurchased = gallonsDefPurchased ? parseFloat(gallonsDefPurchased) : null;
    }
    if (pumpPriceDef !== undefined) {
      updateData.pumpPriceDef = pumpPriceDef ? parseFloat(pumpPriceDef) : null;
    }
    updateData.costDef = costDef.toFixed(2);
    updateData.totalFuelStopCost = totalFuelStopCost.toFixed(2);

    await fuelStop.update(updateData);
    res.json(fuelStop);
  } catch (err) {
    console.error('Error updating fuel stop:', err);
    if (err.name === 'SequelizeValidationError') {
      return res.status(400).json({ message: 'Validation failed', errors: err.errors.map(e => e.message) });
    }
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete Fuel Stop
app.delete('/api/fuelstops/:id', authenticate, async (req, res) => {
  try {
    const fuelStopId = req.params.id;
    const fuelStop = await FuelStops.findOne({ where: { id: fuelStopId, userId: req.userId } });

    if (!fuelStop) {
      return res.status(404).json({ message: 'Fuel stop not found or access denied' });
    }

    await fuelStop.destroy();
    res.status(200).json({ message: 'Fuel stop deleted successfully' }); // Changed to 200 for delete with message
  } catch (err) {
    console.error('Error deleting fuel stop:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

app.listen(3001, () => console.log('Server running on port 3001'));