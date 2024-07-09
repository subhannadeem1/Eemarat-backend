const express = require("express");
const app = express();
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const cloudinary = require("cloudinary");

const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");
const dotenv = require("dotenv");
// const { privateDecrypt } = require("crypto");

dotenv.config({
  path: "./config/.env",
});
const port = process.env.PORT || 4000;

app.use(express.json());
app.use(cors({ origin: ["*"], allowedHeaders: ["*"] }));
app.use(express.urlencoded({ extended: true }));

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
const multer = require("multer");

const upload = multer();

// Database connection with mongoDB

connectDB();

// API Creation

app.get("/", (req, res) => {
  res.send("Express app is Running");
});

// Image storage engine

// Creating endpoint for images
// app.use("/images", express.static("upload/images"));
app.post("/upload", upload.none(), async (req, res) => {
  const result = await cloudinary.v2.uploader.upload(req.body.product, {
    folder: "product",
  });
  res.json({
    success: 1,
    image_url: result.secure_url,
  });
});

// Schema for creating products

const Product = mongoose.model("Product", {
  id: {
    type: Number,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  image: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    required: true,
  },
  new_price: {
    type: Number,
    required: true,
  },
  aGradePrice: {
    type: Number,
  },
  bGradePrice: {
    type: Number,
  },

  brand: {
    type: String,
  },
  unit: {
    type: String,
  },
  description: {
    type: String,
    required: true,
  },
  size: {
    type: String,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  available: {
    type: Boolean,
    default: true,
  },
});

app.post("/addproduct", async (req, res) => {
  let products = await Product.find({});
  let id;
  if (products.length > 0) {
    let last_product_array = products.slice(-1);
    let last_product = last_product_array[0];
    id = last_product.id + 1;
  } else {
    id = 1;
  }
  const product = new Product({
    id: id,
    name: req.body.name,
    image: req.body.image,
    category: req.body.category,
    new_price: req.body.new_price,
    aGradePrice: req.body.aGradePrice,
    bGradePrice: req.body.bGradePrice,
    brand: req.body.brand,
    unit: req.body.unit,
    description: req.body.description,
    size: req.body.size,
  });
  await product.save();
  console.log(product);
  res.json({
    success: true,
    name: req.body.name,
  });
});

// Creating API for deleting products
app.post("/removeproduct", async (req, res) => {
  await Product.findOneAndDelete({ id: req.body.id });
  console.log("Removed");
  res.json({
    success: true,
    name: req.body.name,
  });
});

// Creating API FOR getting all products*
app.get("/allproducts", async (req, res) => {
  let products = await Product.find({}).sort({ id: -1 });
  console.log("All products Fetched");
  res.send(products);
});

// Schema Creating for User Model
const User = mongoose.model("User", {
  name: {
    type: String,
  },
  email: {
    type: String,
    unique: true,
  },
  password: {
    type: String,
  },
  cartData: {
    type: Object,
  },
  date: {
    type: Date,
    default: Date.now,
  },
});

// Creating endpoint for registering user
app.post("/signup", async (req, res) => {
  let check = await User.findOne({ email: req.body.email });
  if (check) {
    return res.status(400).json({
      success: false,
      errors: "Existing user found with same email",
    });
  }
  let cart = {};
  for (let i = 0; i < 300; i++) {
    cart[i] = 0;
  }
  const user = new User({
    name: req.body.name,
    email: req.body.email,
    password: req.body.password,
    cartData: cart,
  });

  await user.save();
  const data = {
    user: {
      id: user.id,
    },
  };
  const token = jwt.sign(data, "secret_ecom");
  res.json({ success: true, token });
});

// creating endpoint for user login
app.post("/login", async (req, res) => {
  let user = await User.findOne({ email: req.body.email });
  if (user) {
    const passMatch = req.body.password === user.password;
    if (passMatch) {
      const data = {
        user: {
          id: user.id,
        },
      };
      const token = jwt.sign(data, "secret_ecom");
      res.json({ success: true, token });
    } else {
      res.json({ success: false, errors: "Wrong Password" });
    }
  } else {
    res.json({ success: false, errors: "Wrong Email address" });
  }
});

// Creating endpoint for newcollection data

// Creating endpoint for popularproducts in Gray structure
app.get("/popularproducts", async (req, res) => {
  let products = await Product.find();
  let popularproducts = products.slice(2, 6);
  res.send(popularproducts);
});

// get single product by id
app.get("/product/:id", async (req, res) => {
  let product = await Product.findOne({ id: req.params.id });
  console.log("Single Product Fetched", product);
  res.send(product);
});

// Creating middleware to fetch user
const fetchUser = async (req, res, next) => {
  const token = req.header("auth-token");
  if (!token) {
    res.status(401).send({ errors: "Please authenticate using valid login" });
  } else {
    try {
      const data = jwt.verify(token, "secret_ecom");
      req.user = data.user;
      next();
    } catch (error) {
      res.status(401).send({ errors: "Please authenticate using valid token" });
    }
  }
};

// Creating endpoint for adding products in cartdata
app.post("/addtocart", fetchUser, async (req, res) => {
  const quantity = req.body.quantity;
  let userData = await User.findOne({ _id: req.user.id });
  userData.cartData[req.body.itemId] += quantity;
  await User.findOneAndUpdate(
    { _id: req.user.id },
    { cartData: userData.cartData }
  );
  res.send("Added");
});

// Creating endpoint for remove product
app.post("/removefromcart", fetchUser, async (req, res) => {
  console.log("Removed", req.body.itemId);
  let userData = await User.findOne({ _id: req.user.id });
  if (userData.cartData[req.body.itemId] > 0)
    userData.cartData[req.body.itemId] = 0;
  await User.findOneAndUpdate(
    { _id: req.user.id },
    { cartData: userData.cartData }
  );
  res.send("Removed");
});

// Creating endpoint for getting cartdata
app.post("/getcart", fetchUser, async (req, res) => {
  console.log("Get cart");
  let userData = await User.findOne({ _id: req.user.id });
  res.json(userData.cartData);
});

app.listen(port, (error) => {
  if (!error) {
    console.log("Server is Running on Port " + port);
  } else {
    console.log("Error: " + error);
  }
});

// post work schme

const Work = mongoose.model("Work", {
  id: {
    type: Number,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },

  budget: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  duration: {
    type: String,
    required: true,
  },
  posted_by: {
    type: String,
    required: true,
  },
  proposals: [
    {
      senderName: String,
      senderEmail: String,
      senderPhone: String,
      senderMessage: String,
      experience: String,
      date: { type: Date, default: Date.now },
      price: String,
    },
  ],
  date: {
    type: Date,
    default: Date.now,
  },
});

// post work api

app.post("/postWork", fetchUser, async (req, res) => {
  let works = await Work.find({});
  let id;
  if (works.length > 0) {
    let last_work_array = works.slice(-1);
    let last_work = last_work_array[0];
    id = last_work.id + 1;
  } else {
    id = 1;
  }
  const newWork = new Work({
    id: id,
    title: req.body.title,
    budget: req.body.budget,
    duration: req.body.duration,
    description: req.body.description,
    posted_by: req.user.id,
    proposals: [],
  });
  await newWork.save();
  res.json({
    success: true,
    name: req.body.title,
  });
});

app.get("/allWorks", fetchUser, async (req, res) => {
  let works = await Work.find({}).sort({ id: -1 });
  const otherUserWorks = works.filter((work) => work.posted_by !== req.user.id);
  console.log("All work Fetched");
  res.send(otherUserWorks);
});

app.get("/my-projects", fetchUser, async (req, res) => {
  let works = await Work.find({}).sort({ id: -1 });
  const myProjects = works.filter((work) => work.posted_by === req.user.id);
  res.send(myProjects);
});

app.get("/project/:id", async (req, res) => {
  const id = req.params.id;
  let project = await Work.findOne({ id: id });
  res.send(project);
});

app.post("/proposal", fetchUser, async (req, res) => {
  try {
    const currentUser = await User.findById(req.user.id);
    const id = req.body.projectId;
    const project = await Work.findOne({ id: id });
    // check if the user has already sent the proposal
    for (let i = 0; i < project.proposals.length; i++) {
      if (
        project.proposals[i].senderEmail === currentUser.email ||
        project.proposals[i].senderPhone === currentUser.phone
      ) {
        throw new Error("You have already sent a proposal");
      }
    }
    if (project) {
      project.proposals.push({
        senderName: currentUser.name,
        senderEmail: currentUser.email,
        senderPhone: req.body.phone,
        senderMessage: req.body.message,
        experience: req.body.experience,
        price: req.body.price,
      });

      await project.save();
      res.send(project);
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/delete-project/:id", async (req, res) => {
  const id = req.params.id;
  console.log(id);
  await Work.findOneAndDelete({ id: id });
  res.send({ success: true });
});

//booking worker schema
const bookingSchema = new mongoose.Schema({
  workerId: String,
  workerTitle: String,
  workerCost: Number,
  city: String,
  clientName: String,
  clientContact: String,
  date: Date,
  totalCost: Number,
  numLaborers: Number,
  
});

const BookingModel = mongoose.model('Booking', bookingSchema);
//worker endpoint
app.post('/bookWorker', async (req, res) => {
  try {
    const { workerId, workerTitle, workerCost, city, bookingDetails } = req.body;
    const newBooking = new BookingModel({
      workerId,
      workerTitle,
      workerCost,
      city,
      clientName: bookingDetails.clientName,
      
      clientContact: bookingDetails.clientContact,
      date: bookingDetails.date,
      totalCost: bookingDetails.totalCost,
      numLaborers: bookingDetails.numLaborers
    });
    await newBooking.save();
    res.json({ success: true, message: 'Booking confirmed' });
  } catch (error) {
    console.error('Failed to create booking:', error);
    res.status(500).json({ success: false, message: 'Failed to create booking', error: error.message });
  }
});
// Backend endpoint to fetch all bookings
app.get('/bookings', async (req, res) => {
  try {
    const bookings = await BookingModel.find();
    res.status(200).json(bookings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});


