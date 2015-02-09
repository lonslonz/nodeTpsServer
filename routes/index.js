var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {

  res.render('index', { title: 'Express' });
});

router.get('/resp', function(req, res, next) {

  setTimeout(function() {
    res.render('index', { title: 'Resp '});
  }, 2000);

});


module.exports = router;
