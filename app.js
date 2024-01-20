const express = require("express");
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bodyParser = require('body-parser');
const app = express();

app.use(bodyParser.urlencoded({ extended: false }));
app.use(session({secret: "your-secret", resave: false, saveUninitialized: true}));
app.use(passport.initialize());
app.use(passport.session());

passport.use(new LocalStrategy(
    (username, password, done) => {
      // Authenticate user here by checking the database
      db.one('SELECT * FROM users WHERE username = $1', username)
        .then(user => {
          if (user.password === password) {
            return done(null, user);
          } else {
            return done(null, false, { message: 'Incorrect password.' });
          }
        })
        .catch(err => {
          return done(null, false, { message: 'User not found.' });
        });
    }
  ));
  
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });
  
  passport.deserializeUser((id, done) => {
    db.one('SELECT * FROM users WHERE id = $1', id)
      .then(user => {
        done(null, user);
      })
      .catch(err => {
        done(err, null);
      });
  });
  
  // Routes
  app.get('/', (req, res) => {
    res.send('Welcome to the Learning Management System');
  });
  
  app.get('/login', (req, res) => {
    res.send('Login page here');
  });
  
  app.post('/login',
    passport.authenticate('local', { successRedirect: '/dashboard', failureRedirect: '/login' })
  );
  
  app.get('/dashboard', (req, res) => {
    if (req.isAuthenticated()) {
      res.send('Dashboard for logged-in users');
    } else {
      res.redirect('/login');
    }
  });

module.exports = app;