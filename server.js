const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sequelize, User, Load } = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Register
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ username, email, password: hashedPassword });
    res.status(201).json({ message: 'User registered', userId: user.id });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) return res.status(401).json({ error: 'Invalid credentials' });
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// Middleware to verify JWT
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// CRUD for Loads
app.get('/api/loads', authenticate, async (req, res) => {
  const loads = await Load.findAll({ where: { userId: req.userId } });
  res.json(loads);
});

app.post('/api/loads', authenticate, async (req, res) => {
  const { proNumber, dateDispatched, dateDelivered, trailerNumber, originCity, originState, destinationCity, destinationState, deadheadMiles, loadedMiles, weight, linehaul, fsc } = req.body;
  const calculatedGross = (linehaul * 0.68) + fsc;
  const fuelCost = 100; // Dummy
  const scaleCost = 50; // Dummy
  const projectedNet = calculatedGross - (fuelCost + scaleCost);
  const load = await Load.create({
    proNumber,
    dateDispatched,
    dateDelivered,
    trailerNumber,
    originCity,
    originState,
    destinationCity,
    destinationState,
    deadheadMiles,
    loadedMiles,
    weight,
    linehaul,
    fsc,
    calculatedGross,
    fuelCost,
    scaleCost,
    projectedNet,
    userId: req.userId,
  });
  res.status(201).json(load);
});

app.put('/api/loads/:proNumber', authenticate, async (req, res) => {
  const { proNumber } = req.params;
  const { dateDispatched, dateDelivered, trailerNumber, originCity, originState, destinationCity, destinationState, deadheadMiles, loadedMiles, weight, linehaul, fsc } = req.body;
  const calculatedGross = (linehaul * 0.68) + fsc;
  const fuelCost = 100; // Dummy
  const scaleCost = 50; // Dummy
  const projectedNet = calculatedGross - (fuelCost + scaleCost);
  const load = await Load.findOne({ where: { proNumber, userId: req.userId } });
  if (!load) return res.status(404).json({ error: 'Load not found' });
  await load.update({
    dateDispatched,
    dateDelivered,
    trailerNumber,
    originCity,
    originState,
    destinationCity,
    destinationState,
    deadheadMiles,
    loadedMiles,
    weight,
    linehaul,
    fsc,
    calculatedGross,
    fuelCost,
    scaleCost,
    projectedNet,
  });
  res.json(load);
});

app.delete('/api/loads/:proNumber', authenticate, async (req, res) => {
  const { proNumber } = req.params;
  const load = await Load.findOne({ where: { proNumber, userId: req.userId } });
  if (!load) return res.status(404).json({ error: 'Load not found' });
  await load.destroy();
  res.json({ message: 'Load deleted' });
});

const PORT = process.env.PORT || 3001;
sequelize.sync().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});