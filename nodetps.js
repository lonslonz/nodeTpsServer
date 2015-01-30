/**
 * by Jongmin Lee on 15. 1. 29..
 * MIT Licensed
 */
var debug = require('debug')('nodetps');
var onFinished = require('on-finished');

/*
options : {
    savePeriod : 60 sec,
    mysql : {

    },

    INCLUDE static
    ALL
    CSS
}

from ~ to :
tps,
response time,
*/

exports = module.exports = nodetps;


var optionsDefault  = {
    responseIntervalMillis : [10, 50, 100, 200, 500, 1000, 2000, 5000, 9999999],
    saveIntervalSec : 5000,
    writeToConsole : true,
    saveToMySQL : null,
    saveToFile : null,
    excludeStatic : true
};

var definedOptions = {};

var totalCount = 0;
var totalElapsed = 0;
var countEachInterval = [];
var elapsedEachInterval = [];


function nodetps(options, saveCallback) {
    var op = options || {};

    for(var i in optionsDefault) {
        if(typeof op[i] == "undefined") {
            definedOptions[i] = optionsDefault[i];
        } else {
            definedOptions[i] = op[i];
        }
    }

    for(var i = 0; i < definedOptions.responseIntervalMillis.length; i++) {
        elapsedEachInterval[i] = 0;
        countEachInterval[i] = 0;
    }

    setInterval(save, definedOptions.saveIntervalSec);

    return function registerReq(req, res, next) {
        req._reqStart = process.hrtime();

        function addResponse(){

            // TODO:filter only restful
            var elapsed = calcElapsed(req._reqStart);

            debug("nodetps : " + req.url + ", elapsed : " + elapsed + ", totalCount = " + totalCount);
            var i;
            for(i = 0; i < definedOptions.responseIntervalMillis.length; i++) {

                if(elapsed <= definedOptions.responseIntervalMillis[i]) {
                    elapsedEachInterval[i] += elapsed;
                    countEachInterval[i]++;
                    break;
                } else {
                    continue;
                }
            }

            totalCount++;
            totalElapsed += elapsed;
        };

        onFinished(res, addResponse);

        next();
    };
};
function reset() {
    totalCount = 0;
    totalElapsed = 0;
    for(var i = 0; i < countEachInterval.length; i++) {
        countEachInterval[i] = 0;
        elapsedEachInterval[i] = 0;
    }
}
function calcTps(count, elapsed) {
    if(!elapsed) {
        return 0;
    }
    var calc = (count/elapsed).toFixed(2);
    return Number(calc);
}
function makePercentInterval(countInterval, totalCount) {
    var percentInterval = [];
    for(var i = 0; i < countInterval.length; i++) {

        var temp;
        if(totalCount != 0) {
            temp = countInterval[i] / totalCount * 100;
        } else {
            temp = 0;
        }
        percentInterval[i] = Number(temp.toFixed(2));
    }
    return percentInterval;
}
function makeResult() {
    var result = {};

    result.totalCount = totalCount;
    result.totalElapsed = totalElapsed;
    result.tps = calcTps(totalCount, totalElapsed);
    result.countResponseInterval = countEachInterval;
    result.elapsedResponseInterval = elapsedEachInterval;
    result.percentResponseInterval = makePercentInterval(countEachInterval, totalCount);
    return result;
}
function save() {
    var message = JSON.stringify(makeResult());

    if(definedOptions.writeToConsole) {
        process.stdout.write(message + '\n');
    }
    reset();
}
function calcElapsed(start){
    if(!start) {
        return Number(0);
    }
    var elapsed = process.hrtime(start);
    var temp = elapsed[0] * 1e3 + elapsed[1] * 1e-6;
    return Number(temp.toFixed(2));
};