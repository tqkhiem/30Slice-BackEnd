const Combos = require('../models/Combos');

const router = require('express').Router();

// add bookings to the database
router.post('/', async (req, res) => {
  const newCombos = new Combos(req.body);
  try {
    const saveCombos = await newCombos.save();
    res.status(200).json(saveCombos);
  } catch (err) {
    res.status(400).json(err);
  }
});

// get combos for admin
router.get('/getAllCombos', async (req, res) => {
  try {
    const data = await Combos.find().sort({ Ordinal: 1 });
    res.status(200).json(data);
  } catch (err) {
    res.status(400).json(err);
  }
});

//get One
router.get('/getOneCombos', async (req,res) => {
  try{
    const data = Combos.findById(req.body._id);
    res.status(200).json(data)
  }catch(err) {
    res.status(400).json(err);
  }
})

//update
router.put("/", async (req, res) => {
  try {
    await Combos.findByIdAndUpdate(
      req.body._id,
      { $set: req.body },
      { new: true }
    );
    res.status(200).json("update ss");
  } catch (err) {
    res.status(400).json(err);
  }
});

//delete
router.delete('/',async (req,res) => {
  try {
    await Combos.findByIdAndDelete(
      { _id: req.body._id }
    );
    res.status(200).json('delete success!!');
  } catch (err) {
    res.status(400).json(err);
  }
})

module.exports = router;
