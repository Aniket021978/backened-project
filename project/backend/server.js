const express = require('express');
// const session = require('express-session');
const mongoose = require('mongoose');
// const mongodbStore = require('connect-mongodb-session')(session)
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const Product = require('./model/product');
const User = require('./model/user');
const CartItem = require('./model/cartitem');
const databaseUri = 'mongodb+srv://aniket021978:aniket021978@cluster0.8zslwh8.mongodb.net/';
const methodOverride = require('method-override');

async function db(){
    await mongoose.connect(databaseUri);
}
db()
.then(res=>console.log("DB connected"))
.catch(err=>console.log(`error ${err}`));

// const store = new mongodbStore(
//     {
//         uri:databaseUri,
//         collection:"sessions"
//     }
// )
const PORT = 4000;

const application = express();

// middleware
application.set('view engine','ejs');
application.use(cookieParser());
application.use(express.urlencoded({extended:true}));
application.use(methodOverride('_method')); 
// application.use(session({
//     secret:"thisisasecretkeytosigncookies",
//     resave:false,
//     saveUninitialized:false,
//     cookie:{
//         secure:false,
//         maxAge:60000
//     },
//     store:store
// }));

application.use((req,res,next)=>{
 const {auth} = req.cookies;
 if(auth){
    req.isAuthenticated = true;
 }else{
    req.isAuthenticated = false;
 }
 next();
})
const isAuthenticated = (req,res,next)=>{
    if(req.isAuthenticated){
        next();
    }else{
        res.status(401).redirect("/login");
    }
}
application.get("/",isAuthenticated,async (req,res)=>{
    try{
        const products = await Product.find({});
        res.render('home',{products});
    }catch(error){
        console.log(error);
        res.status(500).render('home',{error:"Internal server error"})
    }
})
// Routing
application.get("/logout",(req,res)=>{
    res.clearCookie("auth");
    res.status(200).redirect("/login");
})

application.get("/login",(req,res)=>{
    res.render('login');
})

application.get("/register",(req,res)=>{
    res.render('register',{"error":""});
})

application.post('/register',async (req,res)=>{
    console.log(req.body);
    const {username,password} = req.body;
    try{
        if(!username || !password){
            res.status(401).render('register',{'error':"Enter username and password"})
        }
        const existingUser = await User.findOne({username});
        if(existingUser){
            res.status(400).render('register',{"error":"Username already exists"})
            return;
        }
        const hashedPassword = bcrypt.hashSync(password,10);
        const newUser = new User({
            username,
            password:hashedPassword
        })
        await newUser.save();
        res.status(201).redirect('/login');
    }catch(error){
        console.log(error);
        res.status(500).render('register',{'error':"Internal server error"})
    }
})

application.post('/login',async (req,res)=>{
    const {username,password} = req.body;
    try{
        const user = await User.findOne({username});
        if(user && bcrypt.compareSync(password,user.password)){
            res.cookie('auth',true);
            res.status(201).redirect('/');
        }else{
            res.status(500).render('login',{'error':"Incorrect username/password"})
        }
    }catch(error){
        console.log(error);
        res.status(500).render('login',{'error':"Internal server error"})
    }
})

application.get('/cart', async (req, res) => {
    try {
        const cartItems = await CartItem.find({}).populate('product');
        const total = cartItems.reduce((acc, item) => acc + item.quantity * item.product.price, 0);

        console.log(cartItems);
        res.render('cart', { cart: cartItems, total });
    } catch (error) {
        console.log(error);
        res.status(500).render('cart', { 'error': "Internal server error" });
    }
});



application.post('/addToCart',async (req,res)=>{
    try {
        console.log(req.body);
        const productId = req.body.productId;
        const quantity = parseInt(req.body.quantity);
        const product = await Product.findById(productId);
        if(!product){
            return res.status(404).send("Product not found");
        }
        const existingCartItem = await CartItem.findOne({product:productId});
        if(existingCartItem){
            existingCartItem.quantity += 1;
            await existingCartItem.save()
        }else{
            await CartItem.create({
                product:productId,
                quantity:quantity
            });
        }
        res.redirect("/");

    } catch (error) {
        console.log(error);
        res.status(500).render('cart',{'error':"Internal server error"})
    }
})
application.delete('/removeFromCart/:productId', isAuthenticated, async (req, res) => {
    try {
        const productId = req.params.productId;
        const existingCartItem = await CartItem.findOne({ product: productId });

        if (!existingCartItem) {
            return res.status(404).send("Item not found in the cart");
        }
        await CartItem.deleteOne({ product: productId });

        res.redirect('/cart');
    } catch (error) {
        console.log(error);
        res.status(500).render('cart', { 'error': "Internal server error" });
    }
});

application.put('/updateCart/:productId', isAuthenticated, async (req, res) => {
    try {
        const productId = req.params.productId;
        const { quantity } = req.body;
        const existingCartItem = await CartItem.findOne({ product: productId });

        if (!existingCartItem) {
            return res.status(404).send("Item not found in the cart");
        }
        existingCartItem.quantity = parseInt(quantity, 10);
        await existingCartItem.save();

        // Redirect back to the cart
        res.redirect('/cart');
    } catch (error) {
        console.log(error);
        res.status(500).render('cart', { 'error': "Internal server error" });
    }
});

application.post('/checkout', isAuthenticated, async (req, res) => {
    try {
        res.render('checkout-success', { message: "Checkout successful!" });
    } catch (error) {
        console.log(error);
        res.status(500).render('checkout', { 'error': "Internal server error" });
    }
});

application.get('/checkout', isAuthenticated, async (req, res) => {
    try {
        const userDetails = await User.findOne({});
        const cartItems = await CartItem.find({}).populate('product');
        const total = cartItems.reduce((acc, item) => acc + item.quantity * item.product.price, 0);

        res.render('checkout', { user: userDetails, cart: cartItems, total });
    } catch (error) {
        console.log(error);
        res.status(500).render('checkout', { 'error': "Internal server error" });
    }
});

application.listen(PORT,()=>{
    console.log(`Listening to port ${PORT}`);
})