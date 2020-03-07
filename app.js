var express = require("express");
var app = express();
var bodyParser = require("body-parser");
var mongoose =  require("mongoose");
var methodOverride = require("method-override");
var passport = require("passport");
var localStrategy = require("passport-local");
var passportLocalMongoose = require("passport-local-mongoose");
var sanitizer = require("express-sanitizer");
var flash = require("connect-flash");

var dbURL = process.env.DATABASEURL || 'mongodb://localhost:27017/blogApp';
mongoose.connect(dbURL, {useNewUrlParser: true});
app.set("view engine","ejs");
app.use(bodyParser.urlencoded({extended: true}));
app.use(methodOverride("_method"));
app.use(flash());
app.use(sanitizer());

var blogSchema = new mongoose.Schema({
	title: String,
	image: String,
	body: String,
	created: {type: Date, default: Date.now},
	user: String
});
var userSchema = new mongoose.Schema({
	username: String,
	password: String
});
userSchema.plugin(passportLocalMongoose);

var User = mongoose.model("User",userSchema)
var blog = mongoose.model('Blog', blogSchema);

app.use(require("express-session")({
	secret: "abd",
	resave: false,
	saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(new localStrategy(User.authenticate()));
passport.serializeUser(User.serializeUser());
passport.deserializeUser(User.deserializeUser());

app.use(function(req,res,next){
	res.locals.currentUser = req.user;
	res.locals.error = req.flash("error");
	res.locals.success = req.flash("success");
	next();
});

app.get("/",function(req,res){
	res.redirect("/blogs");
});

app.get("/register",function(req,res){
	res.render("register");
});

app.post("/register",function(req,res){
	var newUser = new User({username: req.body.username});
	User.register(newUser,req.body.password,function(err,user){
		if(err){
			req.flash("error",err.message);
			res.redirect("/register");
		} else {
			passport.authenticate("local")(req,res,function(){
				req.flash("success","Hi " + user.username + ", Welcome to The BlogApp!")
				res.redirect("/blogs");
			});
		}
	});
});

app.get("/login",function(req,res){
	res.render("login");
});

app.post("/login",passport.authenticate("local",{
	successRedirect: "/blogs",
	failureRedirect: "/login",
	failureFlash: true
}),function(req,res){
});

app.get("/logout",function(req,res){
	req.logout();
	req.flash("success","Logged you out!!");
	res.redirect("/blogs")
});

app.get("/blogs",function(req,res){
	blog.find({},function(err,blogs){
		if(err){
			req.flash("error","Something went wrong!!");
		} else {
			res.render("index",{blogs: blogs});
		}
	});
});

app.get("/blogs/new",isLoggedIn,function(req,res){
	res.render("new");
});

app.post("/blogs",function(req,res){
	req.body.blog.body = req.sanitize(req.body.blog.body);
	req.body.blog.user = req.user.username;
	blog.create(req.body.blog,function(err,blog){
		if(err){
			req.flash("error","Something went wrong!!");
			res.redirect("/blogs/new");
		} else {
			req.flash("success","Blog created!!");
			res.redirect("/blogs");
		}
	});
});

app.get("/blogs/:id",function(req,res){
	blog.findById(req.params.id,function(err,foundBlog){
		if(err){
			req.flash("error","Blog not found!!");
			res.redirect("/blogs");
		} else {
			res.render("show",{blog: foundBlog});
		}
	});
});

app.get("/blogs/:id/edit",blogOwnership,function(req,res){
	blog.findById(req.params.id,function(err,blog){
		if(err){
			req.flash("error","Blog not found!!");
			res.redirect("/blogs");
		} else {
			res.render("edit",{blog: blog});
		}
	});
});

app.put("/blogs/:id",blogOwnership,function(req,res){
	req.body.blog.body = req.sanitize(req.body.blog.body);
	req.body.blog.user = req.user.username;
	blog.findByIdAndUpdate(req.params.id,req.body.blog,function(err,updatedBlog){
		if(err){
			req.flash("error","Blog not found!!");
			res.redirect("/blogs");
		} else {
			req.flash("success","Blog edited!!");
			res.redirect("/blogs/"+req.params.id);
		}
	});
});

app.delete("/blogs/:id",blogOwnership,function(req,res){
	blog.findByIdAndDelete(req.params.id,function(err){
		if(err){
			req.flash("error","Blog not found!!");
			res.redirect("/blogs");
		} else {
			req.flash("success","Blog deleted!!");
			res.redirect("/blogs");
		}
	});
});

function isLoggedIn(req,res,next){
	if(req.isAuthenticated()){
		return next();
	}
	req.flash("error","Login to continue!!");
	res.redirect("/login");
}

function blogOwnership(req,res,next) {
	if(req.isAuthenticated()) {
		blog.findById(req.params.id,function(err,blog){
			if(err) {
				req.flash("error","Blog not found!!");
				res.redirect("/blogs/" + req.params.id);
			} else {
				if(blog.user==req.user.username) {
					next();
				} else {
					req.flash("error","Permission Denied!!");
					res.redirect("/blogs/" + req.params.id);
				}
			}
		});
	} else {
		req.flash("error","Login to continue!!");
		res.redirect("/login");
	}
}

app.listen(process.env.PORT || 3000, process.env.IP);