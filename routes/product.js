const Product = require("../models/Product");

const router = require("express").Router();

//them
router.post("/", async (req, res) => {
  const newProduct = new Product(req.body);
  try {
    const savedProduct = await newProduct.save();
    res.status(200).json(savedProduct);
  } catch (err) {
    res.status(400).json(err);
  }
});

//sua
router.put("/", async (req, res) => {
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.body._id,
      { $set: req.body },
      { new: true }
    );
    res.status(200).json(updatedProduct);
  } catch (err) {
    res.status(400).json(err);
  }
});

//toggle isShow
router.put("/changeHideOrShow", async (req, res) => {
  try {
    const updatedProduct = await Product.findOneAndUpdate(
      { _id: req.body._id },
      { Is_Show: req.body.Is_Show }
    );
    res.status(200).json("change success!!");
  } catch (err) {
    res.status(400).json(err);
  }
});

//show
router.get("/getAllProducts", async (req, res) => {
  try {
    const products = await Product.find();
    res.status(200).json(products);
  } catch (err) {
    res.status(400).json(err);
  }
});

//show by category
router.get("/getProductsByCategory/:id", async (req, res) => {
  const Id_Categories = req.params.id;
  try {
    const products = await Product.find({
      Id_Categories: Id_Categories
    });
    res.status(200).json(products);
  } catch (err) {
    res.status(400).json(err);
  }
});

//show one product
router.get("/getOneProduct/:id", async (req, res) => {
  const Id_Product = req.params.id;
  try {
    const products = await Product.findById(Id_Product)
    res.status(200).json(products);
  } catch (err) {
    res.status(400).json(err);
  }
});

// get product by page and limit and return total page
router.get("/getProducts", async (req, res) => {
  const page = req.query.page;
  const limit = req.query.limit;
  const totalItem = await Product.countDocuments();
  const totalPage = Math.ceil(totalItem / limit);
  try {
    const products = await Product.find()
      .skip((page - 1) * limit)
      .limit(limit * 1);
    res.status(200).json({ totalItem, totalPage, products });

  } catch (err) {
    res.status(400).json(err);
  }
});



module.exports = router;
