require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const app = express();

// Middleware
app.use(express.json());

// MongoDB Connection
mongoose.connect('mongodb://localhost:27017/ecommerce-app', {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('Connected to MongoDB');
}).catch((err) => {
  console.error('Error connecting to MongoDB', err);
});

// JWT Secret Key
const jwtSecretKey = process.env.JWT_SECRET_KEY;

// Auth Middleware
const authMiddleware = (req, res, next) => {
  const token = req.header('Authorization');
  if (!token) {
    return res.status(401).send('Access denied. No token provided.');
  }

  try {
    const decoded = jwt.verify(token, jwtSecretKey);
    req.user = decoded;
    next();
  } catch (ex) {
    res.status(400).send('Invalid token.');
  }
};

// Models
const User = require('./models/User');
const Product = require('./models/Product');
const Cart = require('./models/Cart');

// Routes
app.post('/register', async (req, res) => {
  console.log('hii inside register');
  try {
    const { name, email, password } = req.body;
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).send('User already registered.');
    }

    user = new User({ name, email, password });
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    await user.save();

    const token = jwt.sign({ _id: user._id }, jwtSecretKey);
    res.send({ token });
  } catch (err) {
    res.status(500).send('Internal server error');
  }
});

app.post('/login', async (req, res) => {
  console.log("Inside server login");
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).send('Invalid email or password.');
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(400).send('Invalid email or password.');
    }

    const token = jwt.sign({ _id: user._id }, jwtSecretKey);
    res.send({ token });
  } catch (err) {
    res.status(500).send('Internal server error');
  }
});

app.get('/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.send(products);
  } catch (err) {
    res.status(500).send('Internal server error');
  }
});

app.get('/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).send('Product not found');
    }
    res.send(product);
  } catch (err) {
    res.status(500).send('Internal server error');
  }
});

app.post('/products', authMiddleware, async (req, res) => {
  try {
    // Add additional check to ensure the user is an admin
    const { name, description, price } = req.body;
    let product = new Product({ name, description, price });
    product = await product.save();
    res.send(product);
  } catch (err) {
    res.status(500).send('Internal server error');
  }
});

app.put('/products/:id', authMiddleware, async (req, res) => {
  try {
    // Add additional check to ensure the user is an admin
    const { name, description, price } = req.body;
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { name, description, price },
      { new: true }
    );
    if (!product) {
      return res.status(404).send('Product not found');
    }
    res.send(product);
  } catch (err) {
    res.status(500).send('Internal server error');
  }
});

app.delete('/products/:id', authMiddleware, async (req, res) => {
    try {
      // Add additional check to ensure the user is an admin
      const product = await Product.findByIdAndRemove(req.params.id);
      if (!product) {
        return res.status(404).send('Product not found');
      }
      res.send(product);
    } catch (err) {
      res.status(500).send('Internal server error');
    }
  });
  
app.get('/cart', authMiddleware, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id }).populate('items.product');
    if (!cart) {
      return res.status(404).send('Cart not found');
    }
    res.send(cart);
  } catch (err) {
    res.status(500).send('Internal server error');
  }
});

app.post('/cart', authMiddleware, async (req, res) => {
  try {
    const { productId, quantity } = req.body;
    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = new Cart({ user: req.user._id, items: [] });
    }

    const itemIndex = cart.items.findIndex(item => item.product.toString() === productId);
    if (itemIndex > -1) {
      cart.items[itemIndex].quantity += quantity;
    } else {
      cart.items.push({ product: productId, quantity });
    }

    await cart.save();
    res.send(cart);
  } catch (err) {
    res.status(500).send('Internal server error');
  }
});

app.delete('/cart/:id', authMiddleware, async (req, res) => {
  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res.status(404).send('Cart not found');
    }

    const itemIndex = cart.items.findIndex(item => item.product.toString() === req.params.id);
    if (itemIndex > -1) {
      cart.items.splice(itemIndex, 1);
      await cart.save();
    }

    res.send(cart);
  } catch (err) {
    res.status(500).send('Internal server error');
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
