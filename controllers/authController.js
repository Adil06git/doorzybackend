const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { generateToken } = require('../utils/tokenGenerator');

const register = async (req, res) => {
  try {
    const { name, email, password, phone, role = 'customer' } = req.body;

    if (role === 'admin') {
      return res.status(403).json({
        message: 'Admin registration is not allowed. Only one admin exists.',
        hint: 'Login as admin@nearcart.com with password: admin123'
      });
    }

    const validRoles = ['customer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role. Only customer registration is allowed' });
    }

    const existing = await User.findByEmail(email);
    if (existing) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      phone,
      role
    });

    const token = generateToken(user._id.toString());
    res.status(201).json({
      token,
      user: { id: user._id, name, email, phone, role }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findByEmail(email);

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: 'Account deactivated' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user._id.toString());
    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getMe = async (req, res) => {
  try {
    const { password, ...userWithoutPassword } = req.user;
    res.json({ user: userWithoutPassword });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  register,
  login,
  getMe
};
