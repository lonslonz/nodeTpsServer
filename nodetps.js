/**
 * by Jongmin Lee on 15. 1. 29..
 * MIT Licensed
 */
var debug = require('debug')('nodetps');
var onFinished = require('on-finished');
var fs = require('fs');
var url = require('url');
var mysql = require('mysql');
var os = require('os');
var async = require('async');
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
exports.setNodeTps = setNodeTps;
exports.collectStatDaily = collectStatDaily;
exports.collectStatAll = collectStatAll;

var optionsDefault  = {
    rangeReponseMillis : [10, 50, 100, 200, 500, 1000, 2000, 5000, 9999999],
    saveIntervalSec : 5000,
    writeToConsole : true,
    saveToMySQL : {
        host: 'recopic-test.cmmciovvbbbs.ap-northeast-1.rds.amazonaws.com',
        port: 3306,
        user: 'ubuntu',
        password: 'reco7788!#%',
        database: 'grus'
    },
    saveToFile : './log.txt',
    includeUrlStartWith : ['/'],
    excludeStaticFilesExt : ['css', 'js', 'html', 'htm', 'jpg', 'png', 'gif', 'ico']
};

var perfViewTableName = "perf_view";
var respRangeTableName = "resp_range";
var definedOptions = {};

var totalCount = 0;
var totalElapsed = 0;
var countAccum = [];
var staticFilePattern = "";


function setNodeTps(req) {
    req.calcNodeTps = true;
}

function nodetps(options, saveCallback) {
    var op = options || {};

    for(var i in optionsDefault) {
        if(typeof op[i] == "undefined") {
            definedOptions[i] = optionsDefault[i];
        } else {
            definedOptions[i] = op[i];
        }
    }

    for(var i = 0; i < definedOptions.rangeReponseMillis.length; i++) {
        countAccum[i] = 0;
    }

    setInterval(save, definedOptions.saveIntervalSec);

    return function registerReq(req, res, next) {
        req._reqStart = process.hrtime();

        if(!includeUrl(req)) {
            return;
        }

        function addResponse(){

            // TODO:filter only restful
            var elapsed = calcElapsed(req._reqStart);

            debug("nodetps : " + req.url + ", elapsed : " + elapsed + ", totalCount = " + totalCount);
            var i;
            for(i = 0; i < definedOptions.rangeReponseMillis.length; i++) {

                if(elapsed <= definedOptions.rangeReponseMillis[i]) {
                    countAccum[i]++;
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
    }
}
function makeExcludeRegEx() {
    if(staticFilePattern) {
        return staticFilePattern;
    }

    var exclude = optionsDefault.excludeStaticFilesExt;
    for(var i = 0; i < exclude.length; i++) {
        var temp = "\\." + exclude[i];
        if(i == exclude.length - 1) {
            staticFilePattern += temp;
        } else {
            staticFilePattern += temp + '|'
        }
    }
    debug(staticFilePattern);
    return staticFilePattern;
}

function includeUrl(req) {
    if(!req.url) {
        return false;
    }
    var parsedUrl = url.parse(req.url);
    var path = parsedUrl.pathname;

    var regex = new RegExp(makeExcludeRegEx());
    if(path.search(regex) > -1) {
        return false;
    }

    var include = optionsDefault.includeUrlStartWith;
    for(var i = 0; i < include.length; i++) {
        if(path.indexOf(include[i]) == 0) {
            debug('include url : ' + path);
            return true;
        }
    }
    return false;
}

function convertCountObjToPercentObj(countObj, totalCount) {
    var percentObj = {};
    for(var key in countObj) {
        var temp;
        if(totalCount != 0) {
            temp = countObj[i] / totalCount * 100;
        } else {
            temp = 0;
        }
        percentObj[countObj[i]] = Number(temp.toFixed(2));
    }
    return percentView;
}
function convertCountArrayToPercentRangeObj(countAccum, totalCount, range) {
    var percentObj = {};
    for(var i = 0; i < countAccum.length; i++) {

        var temp;
        if(totalCount != 0) {
            temp = countAccum[i] / totalCount * 100;
        } else {
            temp = 0;
        }
        percentObj[range[i].toString()] = Number(temp.toFixed(2));
    }
    return percentObj;
}
function convertArrayToRangeObj(dataAccum, range) {

    var obj = {};
    for(var i = 0; i < dataAccum.length; i++) {
        var mills = range[i];
        var value = dataAccum[i];

        obj[mills.toString()] = value;
    }
    return obj;
}

function makeAccumResult() {
    var result = {};

    result.server = os.hostname();
    result.totalCount = totalCount;
    result.totalElapsed = totalElapsed;
    result.tps = calcTps(totalCount, totalElapsed);
    result.avgResp = calcAvgResp(totalCount, totalElapsed);
    result.countAccum = convertArrayToRangeObj(countAccum, optionsDefault.rangeReponseMillis);
    result.percentAccum = convertCountArrayToPercentRangeObj(countAccum, totalCount, optionsDefault.rangeReponseMillis);
    return result;
}

function makeAccumResult4MySQL() {
    var result = {};
    result.perfview = {};
    result.resp_range = [];

    result.perfview.server = os.hostname();
    result.perfview.total_count = totalCount;
    result.perfview.total_elapsed = totalElapsed;
    result.perfview.tps = calcTps(totalCount, totalElapsed);
    result.perfview.avg_resp = calcAvgResp(totalCount, totalElapsed);

    for(var i = 0; i < countAccum.length; i++) {
        result.resp_range[i] = [];
        result.resp_range[i][1] = optionsDefault.rangeReponseMillis[i];
        result.resp_range[i][2] = countAccum[i];
    }

    return result;
}
function setInsertIdToRespArray(resp_range, insertId) {
    for(var i = 0; i < resp_range.length; i++) {
        resp_range[i][0] = insertId;
    }
}
function reset() {
    totalCount = 0;
    totalElapsed = 0;
    for(var i = 0; i < countAccum.length; i++) {
        countAccum[i] = 0;
    }
}
function save() {
    var message = JSON.stringify(makeAccumResult());

    if(definedOptions.writeToConsole) {
        process.stdout.write(message + '\n');
    }

    if(definedOptions.saveToFile) {
        var out = fs.createWriteStream(definedOptions.saveToFile, {flags:'a', encoding: 'utf8'});
        out.write(message + '\n');
        out.end();
    }
    if(definedOptions.saveToMySQL) {
        saveToMySQL();
    }
    reset();
}

function saveToMySQL() {

    var value = makeAccumResult4MySQL();

    var conn = mysql.createConnection(definedOptions.saveToMySQL);

    async.waterfall([
        function(callback) {
            conn.connect(function(err) {
                if(err) {
                    console.error('error connection open : ' + err.stack);
                    return;
                }
                debug("connected to MySQL as id : " + conn.threadId);
                callback(null);
            });
        },
        function(callback) {

            var query = conn.query('INSERT INTO ' + perfViewTableName + ' set ?', value.perfview, function(err, rows, field) {
                if(err) {
                    console.log("error insert into " + perfViewTableName + " : " + err);
                    return;
                }
                debug('rows inserted into ' + perfViewTableName + ' : ' + rows.affectedRows);
                callback(null, rows.insertId);
            });
            debug(query.sql);
        },
        function(insertId, callback) {
            setInsertIdToRespArray(value.resp_range, insertId);
            var queryInner = conn.query('INSERT INTO ' + respRangeTableName +
            ' (perf_id, resp_range, resp_count) values ?', [value.resp_range], function(err, rows, field) {
                if(err) {
                    console.log("error insert into " + respRangeTableName + " : " + err);
                    return;
                }
                debug(' rows inserted into ' + respRangeTableName + ': ' + rows.affectedRows);
                callback(null);
            });
            debug(queryInner.sql);
        },

    ], function(err) {
        conn.end(function(err) {
            if(err) {
                console.error("error connection close : " + err.stack);
            }
        });
    });
}


function calcElapsed(start){
    if(!start) {
        return Number(0);
    }
    var elapsed = process.hrtime(start);
    var temp = elapsed[0] * 1e3 + elapsed[1] * 1e-6;
    return Number(temp.toFixed(2));
}
function calcTps(count, elapsedMills) {
    if(!elapsedMills) {
        return 0;
    }

    var calc = (count/(elapsedMills/1000)).toFixed(2);
    return Number(calc);
}
function calcAvgResp(count, elapsedMills) {
    if(!count) {
        return 0;
    }

    var calc = (elapsedMills/count).toFixed(2);
    return Number(calc);
}


/**
 * Work only with MySQL.
 *
 * @param begin
 * @param end
 * @param server if server is null, all servers data collected.
 */
function collectStatByTime(begin, end, server, group) {


}
function sendDailyReport() {

}
function collectStat(beginTime, endTime) {

}
function collectStatDaily(beginTime, endTime) {
    collectStatLow(beginTime, endTime, true);
}
function collectStatAll(beginTime, endTime) {
    collectStatLow(beginTime, endTime, false);
}


function collectStatLow(beginTime, endTime, daily) {
    var perfViewResult;
    var serverUniqueCount;
    var respRangeResult;
    var conn = mysql.createConnection(definedOptions.saveToMySQL);
    var whereStr =
        ' from ' + perfViewTableName +
        ' where update_time between ? and ? ' +
        ' and total_count > 0 ';

    async.waterfall([
        function(callback) {
            conn.connect(function(err) {
                if(err) {
                    console.error('error connection open : ' + err.stack);
                    return;
                }
                debug("connected to MySQL as id : " + conn.threadId);
                callback(null);
            });
        },
        function(callback) {

            var queryStr =
                'select avg(tps), avg(avg_resp), sum(total_elapsed), sum(total_count) ' +
                whereStr;
            if(daily) {
                queryStr += 'group by date(update_time) ';
            }
            var query = conn.query(queryStr, [beginTime, endTime], function(err, rows) {
                if(err) {
                    console.log("error select " + perfViewTableName + " : " + err);
                    return;
                }
                debug('rows selected. ' + perfViewTableName + ' : ' + rows.count);

                perfViewResult = rows;
                callback(null);
            });
            debug(query.sql);
        },
        function(callback) {

            var queryRespRange = "select resp_range, sum(resp_count) resp_count" +
                "from " + respRangeTableName +
                ' where update_time between ? and ? ' +
                ' group by resp_range ';

            var query = conn.query(queryRespRange, [beginTime, endTime], function(err, rows) {
                if(err) {
                    console.log("error select " + respRangeTableName + " : " + err);
                    return;
                }
                debug('rows selected. ' + respRangeTableName + ' : ' + rows.count);
                var temp = {};
                for(var i in rows) {
                    temp[rows[i].resp_range] = rows[i].resp_count;
                }
                respRangeResult = temp;
                callback(null);
            });
            debug(query.sql);
        },
        function(callback) {
            var queryUniqueServerCount = "select count(distinct server) server " + whereStr;

            var query = conn.query(queryUniqueServerCount, [beginTime, endTime], function(err, rows) {
                if(err) {
                    console.log("error select " + perfViewTableName + " : " + err);
                    return;
                }
                debug('rows selected. ' + perfViewTableName + ' : ' + rows.count);

                serverUniqueCount = rows[0].server;
                callback(null);
            });
            debug(query.sql);
        },
        function(err) {
            conn.end(function (err) {
                if (err) {
                    console.error("error connection close : " + err.stack);
                }
            });
        }
    ], function(err) {
        var lastResult = {};
        lastResult.from = beginTime;
        lastResult.to = endTime;

        lastResult.total = perfViewResult;
        lastResult.response = respRangeResult;

        return lastResult;
    });
}


function setMySQLConnInfo(connInfo) {
    definedOptions.saveToMySQL = connInfo;
}