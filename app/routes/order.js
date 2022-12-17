const router = require("express").Router();
const Order = require("../models/Order");
const Product = require("../models/Product");
const querystring = require("qs");
const dateFormat = require("dateformat");
const mongoose = require("mongoose");
const { authJwt } = require("../middlewares/auth");
const CryptoJS = require("crypto-js");
const https = require("https");
const axios = require("axios");

function sortObject(obj) {
  var sorted = {};
  var str = [];
  var key;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
  }
  return sorted;
}
//get all
router.get("/getAllOrders", async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("Id_Customer", {
        _id: 1,
        Name: 1,
        Phone: 1,
        Email: 1,
        Full_Name: 1,
      })
      .sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (err) {
    console.log(err);
    res.status(400).json(err);
  }
});

router.get("/getOneOrder/:id", authJwt.verifyToken, async (req, res) => {
  try {
    const order = await Order.aggregate([
      {
        $lookup: {
          from: "logins",
          localField: "Id_Customer",
          foreignField: "_id",
          as: "Info",
        },
      },
      {
        $match: {
          _id: new mongoose.Types.ObjectId(req.params.id),
        },
      },
      {
        $unwind: {
          path: "$Info",
        },
      },
      {
        $project: {
          IsCustomer_Delete: 0,
          IsAdmin_Delete: 0,
          __v: 0,
          "Info.Password": 0,
          "Info.__v": 0,
          "Info.createdAt": 0,
          "Info.updatedAt": 0,
        },
      },
    ]);
    res.status(200).json(order[0]);
  } catch (err) {
    res.status(400).json(err);
  }
});

//note
router.put("/noteByAdmin", authJwt.verifyToken, async (req, res) => {
  try {
    await Order.findByIdAndUpdate(req.body._id, {
      Admin_Note: req.body.Admin_Note,
    });
    res.status(200).json("update ss");
  } catch (err) {
    res.status(400).json(err);
  }
});

//get by customer
router.get("/getOrdersByCustomer", authJwt.verifyToken, async (req, res) => {
  try {
    const orders = await Order.find({
      Id_Customer: req.userId,
    }).sort({ createdAt: -1 });
    res.status(200).json(orders);
  } catch (err) {
    res.status(400).json(err);
  }
});

//add
router.post("/", async (req, res) => {
  const newOrder = new Order(req.body);
  try {
    const savedOrder = await newOrder.save();
    const products = savedOrder.Products;
    products.map(async (product) => {
      await Product.findByIdAndUpdate(product._id, {
        $inc: {
          InStock: -product.Quantity,
          Saled: +product.Quantity,
        },
      });
    });
    res.status(200).json(savedOrder);
  } catch (err) {
    res.status(400).json(err);
  }
});

//customer hidden
router.put("/DeleteOrderByUser", async (req, res) => {
  try {
    await Order.findOneAndUpdate(
      { _id: req.body._id },
      { IsCustomer_Delete: true }
    );
    res.status(200).json("Update thành công");
  } catch (err) {
    res.status(400).json(err);
  }
});

//update
router.put("/", async (req, res) => {
  try {
    await Order.findByIdAndUpdate(
      req.body._id,
      { $set: req.body },
      { new: true }
    );
    res.status(200).json("sửa thành công!");
  } catch (err) {
    res.status(400).json(err);
  }
});

//admin hidden
router.put("/DeleteOrderByAdmin", async (req, res) => {
  try {
    await Order.findOneAndUpdate(
      { _id: req.body._id },
      { IsAdmin_Delete: true }
    );
    res.status(200).json("Update thành công");
  } catch (err) {
    res.status(400).json(err);
  }
});

//cancel order
router.put("/CancelOrderByUser", async (req, res) => {
  try {
    await Order.findOneAndUpdate({ _id: req.body._id }, { Status: "huy" });
    res.status(200).json("Update thành công");
  } catch (err) {
    res.status(400).json(err);
  }
});

router.post("/orderVnpay", async (req, res) => {
  const newOrder = new Order(req.body);
  try {
    const savedOrder = await newOrder.save();
    const products = savedOrder.Products;
    products.map(async (product) => {
      await Product.findByIdAndUpdate(product._id, {
        $inc: {
          InStock: -product.Quantity,
          Saled: +product.Quantity,
        },
      });
    });
    let ipAddr =
      req.headers["x-forwarded-for"] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.connection.socket.remoteAddress;
    // console.log(ipAddr);

    let tmnCode = process.env.vnp_TmnCode;
    let secretKey = process.env.vnp_HashSecret;
    let vnpUrl = process.env.vnp_Url;
    let returnUrl = process.env.vnp_ReturnUrl;
    let date = new Date();

    let createDate = dateFormat(date, "yyyymmddHHmmss");
    let orderId = savedOrder._id;

    let vnp_Params = {};
    vnp_Params["vnp_Version"] = "2.1.0";
    vnp_Params["vnp_Command"] = "pay";
    vnp_Params["vnp_TmnCode"] = tmnCode;
    vnp_Params["vnp_Locale"] = "vn";
    vnp_Params["vnp_CurrCode"] = "VND";
    vnp_Params["vnp_TxnRef"] = orderId;
    vnp_Params["vnp_OrderInfo"] = "Thanh toán đơn hàng 30Slice " + orderId;
    vnp_Params["vnp_OrderType"] = "billpayment";
    vnp_Params["vnp_Amount"] = savedOrder.Amount * 100;
    vnp_Params["vnp_ReturnUrl"] = returnUrl;
    vnp_Params["vnp_IpAddr"] = ipAddr;
    vnp_Params["vnp_CreateDate"] = createDate;

    vnp_Params = sortObject(vnp_Params);

    let signData = querystring.stringify(vnp_Params, { encode: false });
    let hmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA512, secretKey);
    let hash = hmac.update(signData).finalize().toString(CryptoJS.enc.Hex);
    vnp_Params["vnp_SecureHash"] = hash;
    vnpUrl += "?" + querystring.stringify(vnp_Params, { encode: false });
    res.status(200).json(vnpUrl);
  } catch (err) {
    res.status(400).json(err);
  }
});
router.get("/vnpay_return", async (req, res) => {
  try {
    let vnp_Params = req.query;
    let secureHash = vnp_Params["vnp_SecureHash"];
    delete vnp_Params["vnp_SecureHash"];
    delete vnp_Params["vnp_SecureHashType"];
    vnp_Params = sortObject(vnp_Params);
    let secretKey = process.env.vnp_HashSecret;
    let signData = querystring.stringify(vnp_Params, { encode: false });
    let hmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA512, secretKey);
    let signed = hmac.update(signData).finalize().toString(CryptoJS.enc.Hex);
    let orderId = vnp_Params["vnp_TxnRef"];

    if (secureHash === signed && vnp_Params["vnp_ResponseCode"] == "00") {
      let rspCode = vnp_Params["vnp_ResponseCode"];
      console.log(orderId);
      const order = await Order.findByIdAndUpdate(orderId, {
        Payment_Status: "completed",
      });
      res
        .status(200)
        .redirect(
          process.env.URL_CLIENT + "/order-success?order_id=" + orderId
        );

      //Kiem tra du lieu co hop le khong, cap nhat trang thai don hang va gui ket qua cho VNPAY theo dinh dang duoi
      // res.status(200).json({ RspCode: "00", Message: "success" });
    } else {
      await Order.findByIdAndUpdate(orderId, {
        Payment_Status: "failed",
        Status: "failed",
      });
      res
        .status(200)
        .redirect(process.env.URL_CLIENT + "/order-fail");
    }
  } catch (err) {
    res.status(400).json(err);
  }
});
router.post("/momoPay", async (req, res) => {
  const newOrder = new Order(req.body);
  try {
    const savedOrder = await newOrder.save();
    const products = savedOrder.Products;
    products.map(async (product) => {
      await Product.findByIdAndUpdate(product._id, {
        $inc: {
          InStock: -product.Quantity,
          Saled: +product.Quantity,
        },
      });
    });
    let partnerCode = "MOMO";
    let accessKey = "F8BBA842ECF85";
    let secretkey = "K951B6PE1waDMi640xX08PD3vg6EkVlz";
    let requestId = savedOrder._id;
    let orderId = savedOrder._id;
    let orderInfo = "Thanh toán đơn hàng 30Slice " + orderId;
    let redirectUrl = "https://momo.vn/return";
    let ipnUrl = (redirectUrl = process.env.URL + "/api/order/momoPay/return");
    let amount = savedOrder.Amount;
    let requestType = "captureWallet";
    let extraData = ""; //pass empty value if your merchant does not have stores
    //before sign HMAC SHA256 with format
    let rawSignature =
      "accessKey=" +
      accessKey +
      "&amount=" +
      amount +
      "&extraData=" +
      extraData +
      "&ipnUrl=" +
      ipnUrl +
      "&orderId=" +
      orderId +
      "&orderInfo=" +
      orderInfo +
      "&partnerCode=" +
      partnerCode +
      "&redirectUrl=" +
      redirectUrl +
      "&requestId=" +
      requestId +
      "&requestType=" +
      requestType;
    //signature
    let signature = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, secretkey)
      .update(rawSignature)
      .finalize()
      .toString(CryptoJS.enc.Hex);
    //json object send to MoMo endpoint
    const requestBody = JSON.stringify({
      partnerCode: partnerCode,
      accessKey: accessKey,
      requestId: requestId,
      amount: amount,
      orderId: orderId,
      orderInfo: orderInfo,
      redirectUrl: redirectUrl,
      ipnUrl: ipnUrl,
      extraData: extraData,
      requestType: requestType,
      signature: signature,
      lang: "en",
    });

    const response = await axios.post(
      "https://test-payment.momo.vn/v2/gateway/api/create",
      requestBody,
      {
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(requestBody),
        },
      }
    );
    res.status(200).json(response.data.payUrl);
  } catch (err) {
    res.status(400).json(err);
  }
});
router.get("/momoPay/return", async (req, res) => {
  try {
    const orderId = req.query.orderId;
    const resultCode = req.query.resultCode;
    const message = req.query.message;
    if (resultCode === "0" && message === "Successful.") {
      await Order.findByIdAndUpdate(orderId, {
        Payment_Status: "completed",
      });
      res
        .status(200)
        .redirect(
          process.env.URL_CLIENT + "/order-success?order_id=" + orderId
        );
    } else {
     const a = await Order.findByIdAndUpdate(orderId, {
        Payment_Status: "failed",
        Status: "failed",
      });
      console.log(a)
      res.status(200).redirect(process.env.URL_CLIENT + "/order-fail");
    }
  } catch (err) {
    res.status(400).json(err);
  }
});

//phan trang order
router.get("/getOrders", async (req, res) => {
  const page = req.query.page;
  const limit = req.query.limit;
  const name = decodeURI(req.query.search);
  try {
    if (name) {
      const orders = await Order.find({
        Receiver: { $regex: name, $options: "i" },
        IsAdmin_Delete : true
      })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit * 1);

      const totalItem = await Order.countDocuments({
        Receiver: { $regex: name, $options: "i" },
      });

      const totalPage = Math.ceil(totalItem / limit);

      res.status(200).json({ totalItem, totalPage, orders });
    } else {
      const totalItem = await Order.countDocuments();
      const totalPage = Math.ceil(totalItem / limit);
      const orders = await Order.find({IsAdmin_Delete : true})
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit * 1);
      res.status(200).json({ totalItem, totalPage, orders });
    }
  } catch (err) {
    res.status(400).json(err);
  }
});
module.exports = router;
