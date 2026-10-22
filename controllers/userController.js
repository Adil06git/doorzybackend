const User = require('../models/User');

const updatePrimaryAddress = async (req, res) => {
  try {
    const { address } = req.body;

    if (!address || address.trim() === '') {
      return res.status(400).json({ message: 'Address is required' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const addresses = user.addresses || [];
    let updatedAddresses = [...addresses];

    const existingIndex = updatedAddresses.findIndex((a) => a.isDefault === true);
    if (existingIndex !== -1) {
      updatedAddresses[existingIndex].address = address.trim();
      updatedAddresses[existingIndex].label = 'Primary';
    } else {
      updatedAddresses.push({
        id: 'addr_' + Date.now(),
        label: 'Primary',
        address: address.trim(),
        isDefault: true
      });
    }

    await User.updateById(req.user.id, {
      address: address.trim(),
      addresses: updatedAddresses
    });

    const updatedUser = await User.findById(req.user.id);
    const { password, ...userWithoutPassword } = updatedUser;

    res.json({
      success: true,
      message: 'Address updated successfully',
      user: userWithoutPassword
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getAddresses = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ addresses: user.addresses || [] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const addAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const address = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2, 5),
      ...req.body,
      isDefault: req.body.isDefault || false
    };

    let addresses = user.addresses || [];
    if (addresses.length === 0 || address.isDefault) {
      addresses = addresses.map((a) => ({ ...a, isDefault: false }));
      address.isDefault = true;
    }

    addresses.push(address);

    await User.updateById(req.user.id, { addresses });

    res.json({
      success: true,
      message: 'Address added successfully',
      addresses
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let addresses = user.addresses || [];
    const addressIndex = addresses.findIndex((a) => a.id === req.params.id);
    if (addressIndex === -1) {
      return res.status(404).json({ message: 'Address not found' });
    }

    if (req.body.isDefault) {
      addresses = addresses.map((a) => ({ ...a, isDefault: false }));
    }

    addresses[addressIndex] = {
      ...addresses[addressIndex],
      ...req.body
    };

    await User.updateById(req.user.id, { addresses });

    res.json({
      success: true,
      message: 'Address updated successfully',
      addresses
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let addresses = user.addresses || [];
    addresses = addresses.filter((a) => a.id !== req.params.id);

    if (addresses.length > 0 && !addresses.some((a) => a.isDefault)) {
      addresses[0].isDefault = true;
    }

    await User.updateById(req.user.id, { addresses });

    res.json({
      success: true,
      message: 'Address deleted successfully',
      addresses
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const setDefaultAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    let addresses = user.addresses || [];
    const addressExists = addresses.some((a) => a.id === req.params.id);
    if (!addressExists) {
      return res.status(404).json({ message: 'Address not found' });
    }

    addresses = addresses.map((a) => ({ ...a, isDefault: a.id === req.params.id }));

    await User.updateById(req.user.id, { addresses });

    res.json({
      success: true,
      message: 'Default address updated',
      addresses
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  updatePrimaryAddress,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress
};
