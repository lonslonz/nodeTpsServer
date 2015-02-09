/**
 * Created by lons on 15. 2. 9..
 */
var assert = require("assert");
var grus = require("..");

describe('Grus', function(){
    describe('options', function(){
        it('merge options', function(){
            var userOptions  = {
                rangeReponseMillis : [10, 50, 100],
                saveIntervalSec : 60000,
                saveToFile : null,
                saveToMySQL : null,
                includeUrlStartWith : ['/']
            };

            var definedOptions = grus.mergeDefaultAndUserOptions(userOptions);

            userOptions["writeToConsole"] = true;
            userOptions["excludeStaticFilesExt"] = ['css', 'js', 'html', 'htm', 'jpg', 'png', 'gif', 'ico'];

            assert.deepEqual(definedOptions, userOptions);

        });

    });
    describe('URL filtering', function() {
        before(function() {
            var userOptions = {
                includeUrlStartWith : ['/test']
            }
            grus.mergeDefaultAndUserOptions(userOptions);

        });
        it('target url', function() {

            var req = {};
            req.url = 'http://test.com/test';
            assert.equal(true, grus.includeUrl(req));
        });
        it('start with target url', function() {

            var req = {};
            req.url = 'http://test.com/testmyurl';
            assert.equal(true, grus.includeUrl(req));
        });
        it('not target url', function() {

            var req = {};
            req.url = 'http://test.com/notIncluded';
            assert.equal(false, grus.includeUrl(req));
        });
        it('static css file should be excluded', function() {

            var req = {};
            req.url = 'http://test.com/test.css';
            assert.equal(false, grus.includeUrl(req));
        });
        it('dynimic .do should be included', function() {

            var req = {};
            req.url = 'http://test.com/test.do';
            assert.equal(true, grus.includeUrl(req));
        });
    });
    describe('converting data', function() {
        it('convert a count to percent', function() {

            var countArray = [3,5,1,1];
            var rangeResponseMillis = [10, 50, 100, 9999];
            var perfObj = grus.convertCountArrayToPercentRangeObj(countArray, 10, rangeResponseMillis);

            assert.deepEqual(perfObj, { '10': 30, '50': 50, '100': 10, '9999': 10 });
        });
        it('convert a count array to obj', function() {

            var countArray = [3,5,1,1];
            var rangeResponseMillis = [10, 50, 100, 9999];

            var perfObj = grus.convertArrayToRangeObj(countArray, rangeResponseMillis);
            assert.deepEqual(perfObj, { '10': 3, '50': 5, '100': 1, '9999': 1 });
        });
        it('convert a mysql selecting result to percent formatted', function() {

            var dbResult = [];
            dbResult[0] = {};
            dbResult[0].respCount = 3;
            dbResult[0].respRange = 10;

            dbResult[1] = {};
            dbResult[1].respCount = 5;
            dbResult[1].respRange = 50;

            dbResult[2] = {};
            dbResult[2].respCount = 1;
            dbResult[2].respRange = 100;

            dbResult[3] = {};
            dbResult[3].respCount = 1;
            dbResult[3].respRange = 9999;

            var rangeResponseMillis = [10, 50, 100, 9999];

            var perfObj = grus.convertMySQLResultToFormattedPercentRangeObj(dbResult, 10);
            assert.deepEqual(perfObj, { '~ 10 ms': '30.00 %', '~ 50 ms': '50.00 %', '~ 100 ms': '10.00 %', '~ 9999 ms': '10.00 %' });
        });

    });
    describe('result formatting', function() {
        it('console log format', function() {
            grus.setTotalCount(10);
            grus.setTotalElapsed(100.0);
            grus.setCountCollected([3,5,1,1]);
            var result = grus.makeCollectingResult();

            var os = require('os');
            var expected =
            {
                server: os.hostname(),
                totalCount: 10,
                totalElapsed: 100,
                tps: 100,
                avgResp: 10,
                countCollected: { '10': 3, '50': 5, '100': 1, '200': 1 },
                percentCollected: { '10': 30, '50': 50, '100': 10, '200': 10 }
            };
            assert.deepEqual(result, expected);

        });
        it('mysql inserting record format', function() {
            grus.setTotalCount(10);
            grus.setTotalElapsed(100.0);
            grus.setCountCollected([3,5,1,1]);
            var result = grus.makeCollectingResult4MySQL();
            var os = require('os');
            var expected =
            {
                perfview:
                {
                    server: os.hostname(),
                    total_count: 10,
                    total_elapsed: 100,
                    tps: 100,
                    avg_resp: 10 },
                    resp_range: [ [ , 10, 3 ], [ , 50, 5 ], [ , 100, 1 ], [ , 200, 1 ] ]
            };

            assert.deepEqual(result, expected);

        });
    });
    describe('calculation', function() {
       it('calc tps', function() {
           var tps = grus.calcTps(10, 2000);
           assert.equal(tps, 5)
       });
    });
});
