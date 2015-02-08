/**
 * by Jongmin Lee on 15. 1. 29..
 * MIT Licensed
 */
var debug = require('debug')('grus');
var onFinished = require('on-finished');
var fs = require('fs');
var url = require('url');
var mysql = require('mysql');
var os = require('os');
var async = require('async');

exports = module.exports = grus;
exports.collectStatDaily = collectStatDaily;
exports.collectStatAll = collectStatAll;

var optionsDefault  = {
    rangeReponseMillis : [10, 50, 100, 200, 500, 1000, 2000, 5000, 9999999],
    saveIntervalSec : 60000,
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
var definedOptions = {};
var staticFilePatternRegex;

var perfViewTableName = "perf_view";
var respRangeTableName = "resp_range";

var totalCount = 0;
var totalElapsed = 0;
var countCollected = [];

function grus(options) {
    var op = options || {};

    for(var i in optionsDefault) {
        if(typeof op[i] == "undefined") {
            definedOptions[i] = optionsDefault[i];
        } else {
            definedOptions[i] = op[i];
        }
    }

    for(var i = 0; i < definedOptions.rangeReponseMillis.length; i++) {
        countCollected[i] = 0;
    }

    setInterval(save, definedOptions.saveIntervalSec);

    return function setUpGrus(req, res, next) {
        req._reqStart = process.hrtime();

        if(!includeUrl(req)) {
            return;
        }

        function collectResponse(){

            var elapsed = calcElapsed(req._reqStart);

            var range;
            for(var i = 0; i < definedOptions.rangeReponseMillis.length; i++) {

                if(elapsed <= definedOptions.rangeReponseMillis[i]) {
                    countCollected[i]++;
                    range = definedOptions.rangeReponseMillis[i];
                    break;
                } else {
                    continue;
                }
            }

            totalCount++;
            totalElapsed += elapsed;

            debug("range : " + range + ", elapsed : " + elapsed + ", totalCount = " + totalCount);
        };

        onFinished(res, collectResponse);

        next();
    }
}
function makeExcludeRegEx() {
    if(staticFilePatternRegex) {
        return staticFilePatternRegex;
    }

    var exclude = optionsDefault.excludeStaticFilesExt;
    for(var i = 0; i < exclude.length; i++) {
        var temp = "\\." + exclude[i];
        if(i == exclude.length - 1) {
            staticFilePatternRegex += temp;
        } else {
            staticFilePatternRegex += temp + '|'
        }
    }
    return staticFilePatternRegex;
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

function convertCountArrayToPercentRangeObj(countCollected, totalCount, range) {
    var percentObj = {};
    for(var i = 0; i < countCollected.length; i++) {

        var temp;
        if(totalCount != 0) {
            temp = countCollected[i] / totalCount * 100;
        } else {
            temp = 0;
        }
        percentObj[range[i].toString()] = Number(temp.toFixed(2));
    }
    return percentObj;
}
function convertArrayToRangeObj(collected, range) {

    var obj = {};
    for(var i = 0; i < collected.length; i++) {
        var mills = range[i];
        var value = collected[i];

        obj[mills.toString()] = value;
    }
    return obj;
}
function convertMySQLResultToFormattedPercentRangeObj(dbResult, totalCount) {
    var percentObj = {};
    for(var i in dbResult) {
        var temp;
        if(totalCount != 0) {
            temp = dbResult[i].respCount / totalCount * 100;
        } else {
            temp = 0;
        }
        percentObj["~ " + dbResult[i].respRange + " ms"] = temp.toFixed(2) + " %";
    }
    return percentObj;
}

function makeCollectingResult() {
    var result = {};

    result.server = os.hostname();
    result.totalCount = totalCount;
    result.totalElapsed = totalElapsed;
    result.tps = calcTps(totalCount, totalElapsed);
    result.avgResp = calcAvgResp(totalCount, totalElapsed);
    result.countCollected = convertArrayToRangeObj(countCollected, optionsDefault.rangeReponseMillis);
    result.percentCollected = convertCountArrayToPercentRangeObj(countCollected, totalCount, optionsDefault.rangeReponseMillis);
    return result;
}

function makeCollectingResult4MySQL() {
    var result = {};
    result.perfview = {};
    result.resp_range = [];

    result.perfview.server = os.hostname();
    result.perfview.total_count = totalCount;
    result.perfview.total_elapsed = totalElapsed;
    result.perfview.tps = calcTps(totalCount, totalElapsed);
    result.perfview.avg_resp = calcAvgResp(totalCount, totalElapsed);

    for(var i = 0; i < countCollected.length; i++) {
        result.resp_range[i] = [];
        result.resp_range[i][1] = optionsDefault.rangeReponseMillis[i];
        result.resp_range[i][2] = countCollected[i];
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
    for(var i = 0; i < countCollected.length; i++) {
        countCollected[i] = 0;
    }
}
function save() {
    var message = JSON.stringify(makeCollectingResult());

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

    var value = makeCollectingResult4MySQL();

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


function collectStatDaily(beginTime, endTime) {
    function postProcess(perfViewResult, respRangeResult) {
        var summaryArray = [];
        var respObj = {};

        var tempForResut = {};
        var j = 0;
        for(var i in perfViewResult) {
            var summary = perfViewResult[i];
            var push = false;
            summary.rangeOfResponseTime = [];
            for(;j < respRangeResult.length; j++) {
                if(summary.beginTime.getTime() == respRangeResult[j].beginTime.getTime()) {
                    summary.rangeOfResponseTime.push(respRangeResult[j]);
                    push = true;
                } else if(summary.beginTime.getTime() < respRangeResult[j].beginTime.getTime()) {
                    break;
                } else {
                    continue;
                }
            }
            if(push) {
                summaryArray.push(summary);
            }
        }

        for(var i in summaryArray) {
            var rangeObj = convertMySQLResultToFormattedPercentRangeObj(summaryArray[i].rangeOfResponseTime, summary.totalCount);
            summaryArray[i].rangeOfResponseTime = rangeObj;
        }
        debug(JSON.stringify(summaryArray, null, '\t'));
        return summaryArray;
    }

    function summarySelectQuery() {
        var queryStr =
            'select ' +
            "date(update_time) beginTime, date(update_time) + interval 1 day endTime, " +
            'format(avg(tps),2) avgTps, format(avg(avg_resp),2) avgRespMillis, ' +
            'format(sum(total_elapsed),2) totalElapsedMillis, sum(total_count) totalCount ' +
            'from ' + perfViewTableName + " " +
            'where update_time between ? and ? ' +
            'and total_count > 0 ' +
            'group by date(update_time) order by date(update_time)';
        return queryStr;
    }
    function respRangeSelectQuery() {
        var queryStr =
            "select " +
            "date(update_time) beginTime, date(update_time) + interval 1 day endTime, " +
            "resp_range respRange, sum(resp_count) respCount " +
            "from " + respRangeTableName + " " +
            'where update_time between ? and ? ' +
            'group by date(update_time), resp_range order by date(update_time), resp_range';
        return queryStr;
    }

    collectStatLow(beginTime, endTime, summarySelectQuery, respRangeSelectQuery, postProcess);
}
function collectStatAll(beginTime, endTime) {

    function postProcess(perfViewResult, respRangeResult) {
        var summary = {};

        summary = perfViewResult[0];
        summary.rangeOfResponseTime = convertMySQLResultToFormattedPercentRangeObj(respRangeResult, summary.totalCount);

        debug(JSON.stringify(summary, null, '\t'));
        return summary;
    }

    function summarySelectQuery() {
        var queryStr =
            'select ' +
            "'" + beginTime + "' beginTime, '" + endTime + "' endTime, " +
            'format(avg(tps),2) avgTps, format(avg(avg_resp),2) avgRespMillis, ' +
            'format(sum(total_elapsed),2) totalElapsedMillis, sum(total_count) totalCount ' +
            'from ' + perfViewTableName + " " +
            'where update_time between ? and ? ' +
            'and total_count > 0 ';
        return queryStr;
    }
    function respRangeSelectQuery() {
        var queryStr =
            "select " +
            "'" + beginTime + "' beginTime, '" + endTime + "' endTime, " +
            "resp_range respRange, sum(resp_count) respCount " +
            "from " + respRangeTableName + " " +
            'where update_time between ? and ? ' +
            'group by resp_range order by resp_range';
        return queryStr;
    }
    collectStatLow(beginTime, endTime, summarySelectQuery, respRangeSelectQuery, postProcess);
}


function collectStatLow(beginTime, endTime, summarySelectQueryCallback, respRangeSelectQueryCallback, postProcessCallback) {
    var perfViewResult;
    var serverUniqueCount;
    var respRangeResult;
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

            var query = conn.query(summarySelectQueryCallback(), [beginTime, endTime, beginTime, endTime], function(err, rows) {
                if(err) {
                    console.log("error select " + perfViewTableName + " : " + err);
                    return;
                }
                debug('rows selected. ' + perfViewTableName + ' : ' + rows.length);

                perfViewResult = rows;
                callback(null);
            });
            debug(query.sql);
        },
        function(callback) {


            var query = conn.query(respRangeSelectQueryCallback(), [beginTime, endTime], function(err, rows) {
                if(err) {
                    console.log("error select " + respRangeTableName + " : " + err);
                    return;
                }
                debug('rows selected. ' + respRangeTableName + ' : ' + rows.length);
                respRangeResult = rows;
                callback(null);
            });
            debug(query.sql);
        },
        function(callback) {
            var queryUniqueServerCount = "select count(distinct server) serverCount " +
                "from " + perfViewTableName + " " +
                'where update_time between ? and ? ' +
                'and total_count > 0 ';

            var query = conn.query(queryUniqueServerCount, [beginTime, endTime], function(err, rows) {
                if(err) {
                    console.log("error select " + perfViewTableName + " : " + err);
                    return;
                }
                debug('rows selected. ' + perfViewTableName + ' : ' + rows.length);

                serverUniqueCount = rows[0].serverCount;
                callback(null);
            });
            debug(query.sql);
        },
        function(callback) {
            conn.end(function (err) {
                if (err) {
                    console.error("error connection close : " + err.stack);
                }
                callback(null);
            });
        }
    ], function(err) {

        var summary = postProcessCallback(perfViewResult, respRangeResult);
        return summary;
    });
}



function setMySQLConnInfo(connInfo) {
    definedOptions.saveToMySQL = connInfo;
}