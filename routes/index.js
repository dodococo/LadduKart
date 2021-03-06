var express = require('express');
var router = express.Router();
var Cart = require('../models/cart');

var Product = require('../models/product');
var Order = require('../models/order');


router.post('/search', function(req, res, next) {
  const searchKey = req.body.searchKey;
  Product.find({"title":new RegExp(searchKey, "i")}, function (err, results) {
    if (err) res.send("Bad server gateway!");
    var productChunks = [];
    var chunkSize = 4;

    for (var i = 0; i < results.length; i += chunkSize) {
        productChunks.push(results.slice(i, i + chunkSize));
    }
    res.render('shop/index', {title: 'Shopping Cart', search:false, products: productChunks,noMessages: true});
  }); 
});

/* GET home page. */
router.get('/', function (req, res, next) {
    const successMsg = req.flash('success')[0];
    let index = Number(req.query.index);
    if (!index) index = 1;
    Product.find(function (err, docs) {
        var productChunks = [];
        var chunkSize = 4;
        var nextIndex;
        var prevIndex;
        for (var i = 0+((index-1)*8); i < 8+((index-1)*8); i += chunkSize) {
            productChunks.push(docs.slice(i, i + chunkSize));
        }
        if (docs.length > 8+((index-1)*8)) {
          nextIndex = index + 1;
        }
        if (index > 1) {
          prevIndex = index - 1;
        }
        res.render('shop/index', {title: 'Shopping Cart',index: index, search: !false, nextIndex: nextIndex, prevIndex: prevIndex, products: productChunks, successMsg: successMsg, noMessages: !successMsg});
    });
});

router.get('/add-to-cart/:id/:qty', function(req, res, next) {
    var productId = req.params.id;
    var qty = Number(req.params.qty);
    var cart = new Cart(req.session.cart ? req.session.cart : {});

    Product.findById(productId, function(err, product) {
       if (err) {
           return res.redirect('/');
       }
        cart.add(product, product.id, qty);
        req.session.cart = cart;
        console.log(req.session.cart);
        res.redirect('/');
    });
});

router.get('/reduce/:id', function(req, res, next) {
    var productId = req.params.id;
    var cart = new Cart(req.session.cart ? req.session.cart : {});

    cart.reduceByOne(productId);
    req.session.cart = cart;
    res.redirect('/shopping-cart');
});

router.get('/remove/:id', function(req, res, next) {
    var productId = req.params.id;
    var cart = new Cart(req.session.cart ? req.session.cart : {});

    cart.removeItem(productId);
    req.session.cart = cart;
    res.redirect('/shopping-cart');
});

router.get('/shopping-cart', function(req, res, next) {
   if (!req.session.cart) {
       return res.render('shop/shopping-cart', {products: null});
   } 
    var cart = new Cart(req.session.cart);
    res.render('shop/shopping-cart', {products: cart.generateArray(), totalPrice: cart.totalPrice});
});

router.get('/checkout', isLoggedIn, function(req, res, next) {
    if (!req.session.cart) {
        return res.redirect('/shopping-cart');
    }
    var cart = new Cart(req.session.cart);
    var errMsg = req.flash('error')[0];
    res.render('shop/checkout', {total: cart.totalPrice, errMsg: errMsg, noError: !errMsg});
});

router.get('/rate/:id/:rating', isLoggedIn, function(req, res, next){
  let rating = Number(req.params.rating);
  let id = req.params.id;

  console.log(id);
  Product.findById(id, function(err, product) {
    if (err) {
        return res.redirect('/');
    }
    
    let count = product.rateCount;
    let currRate = product.rating;
    product.rating = ((currRate * count) + rating )/(count+1);
    product.rating = product.rating.toFixed(1);
    product.rateCount++;
    product.save();
  });
  res.redirect('/');
});

router.post('/checkout', isLoggedIn, function(req, res, next) {
    if (!req.session.cart) {
        return res.redirect('/shopping-cart');
    }
    var cart = new Cart(req.session.cart);
    
    var stripe = require("stripe")(
        "sk_test_gmF5uV3AaYaczKfshGpEqz6P"
    );
    console.log(req.body.stripeToken);
    stripe.charges.create({
        amount: cart.totalPrice * 100,
        currency: "inr",
        source: req.body.stripeToken, // obtained with Stripe.js
        description: "Laddu Purchases"
    }, function(err, charge) {
        const date = new Date();
        if (err) {
            req.flash('error', err.message);
            return res.redirect('/checkout');
        }
        var order = new Order({
            user: req.user,
            cart: cart,
            address: req.body.address,
            name: req.body.name,
            paymentId: charge.id,
        });
        order.save(function(err, result) {
            req.flash('success', 'Successfully bought product!');
            req.session.cart = null;
            res.redirect('/');
        });
    }); 
});

module.exports = router;

function isLoggedIn(req, res, next) {
    if (req.isAuthenticated()) {
        return next();
    }
    req.session.oldUrl = req.url;
    res.redirect('/user/signin');
}
