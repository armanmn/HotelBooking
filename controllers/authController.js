// controllers/authController.js

const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Գրանցում
exports.register = async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Ստուգել, արդյոք օգտատերը արդեն գոյություն ունի
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Օգտատերը արդեն գոյություն ունի' });
    }

    // Գաղտնաբառի հեշավորում
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Ստեղծել նոր օգտատեր
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
    });

    await newUser.save();

    res.status(201).json({ message: 'Գրանցումը հաջողվեց' });
  } catch (error) {
    res.status(500).json({ message: 'Սերվերի սխալ' });
  }
};

// Մուտք
exports.login = async (req, res) => {
  const { email, password } = req.body;

  try {
    // Ստուգել, արդյոք օգտատերը գոյություն ունի
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Սխալ էլ. փոստ կամ գաղտնաբառ' });
    }

    // Ստուգել գաղտնաբառը
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Սխալ էլ. փոստ կամ գաղտնաբառ' });
    }

    // Ստեղծել և ուղարկել JWT թոքեն
    const token = jwt.sign({ id: user._id, isAdmin: user.isAdmin }, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });

    res.json({ token });
  } catch (error) {
    res.status(500).json({ message: 'Սերվերի սխալ' });
  }
};