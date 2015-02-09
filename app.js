var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var routes = require('./routes/index');
var users = require('./routes/users');

var nodetps = require('./index');

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

app.use(nodetps({
    writeToConsole:true,
    saveToMySQL: {
        host: 'recopic-test.cmmciovvbbbs.ap-northeast-1.rds.amazonaws.com',
        port: 3306,
        user: 'ubuntu',
        password: 'reco7788!#%',
        database: 'grus'
    }
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', routes);
app.use('/users', users);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
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

var stringifyDate = require('json-stringify-date')
var curr = new Date();
var currStr = stringifyDate.stringify(new Date());
var ttt = new Date();
console.log(ttt);
nodetps.collectStatAll('2015-02-03 05:00:00', '2015-02-05 23:59:59');
//nodetps.collectStatAll('2015-02-01 00:00:00', '2015-02-01 23:59:59');
nodetps.collectStatDaily('2015-02-03 00:00:00', '2015-02-09 23:59:59');

//nodetps.collectDailyStat('2015-02-03 00:00:00', '2015-02-03 23:59:59');
module.exports = app;
