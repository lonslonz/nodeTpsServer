var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var routes = require('./routes/index');
var users = require('./routes/users');

var nodetps = require('./nodetps');

var app = express();

/*

var t= '/mysearc/test.css';


var t2= '/mysearc/tes151231t.js?test=1';

var s1 = t.search(regex);
var s2 = t2.search(regex);
*/


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// uncomment after placing your favicon in /public
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(nodetps({writeToConsole:true}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/users', users);
app._router.stack.forEach(function(r){
    if (r.route){
        console.log(r.route.path)
    }
})
// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});
var route, routes = [];

app._router.stack.forEach(function(middleware){
    if(middleware.route){ // routes registered directly on the app
        routes.push(middleware.route);
    } else if(middleware.name === 'router'){ // router middleware
        middleware.handle.stack.forEach(function(handler){
            route = handler.route;
            console.log(route);
            route && routes.push(route);
        });
    }
});
// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});

nodetps.collectStatAll('2015-02-03 00:00:00', '2015-02-05 23:59:59');
//nodetps.collectDailyStat('2015-02-03 00:00:00', '2015-02-03 23:59:59');
module.exports = app;
