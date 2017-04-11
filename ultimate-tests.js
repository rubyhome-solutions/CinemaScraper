var nock = require('nock');
var fs = require('fs');
var path = require('path')
var parameterize = require('parameterize');
var _ = require('underscore');
var assert = require('assert');
var expect = require('expect.js');
var ultimateCrawler = require('./ultimate-crawler');

expect.Assertion.prototype._contain = function(obj) {
  this.assert(
    (_.findWhere(this.obj, obj) !== undefined), function() {
      return 'expected ' + expect.stringify(this.obj) + ' to contain ' + expect.stringify(obj)
    }, function() {
      return 'expected ' + expect.stringify(this.obj) + ' to not contain ' + expect.stringify(obj)
    });
  return this;
};


function nockRecord() {
  if (nock.isActive()) {  
    nock.recorder.rec({
      dont_print: true,
      output_objects: true
    });  
  }
}

function nockSave(crawlerId) {
  var nockObjects = nock.recorder.play();

  // nockObjects.forEach(function(nockObject) {
  //   var scope = nockObject.scope.replace(':80', '').replace(/\./g, '-').replace('http://', '');
  //   var path = nockObject.path.replace(/\//g, '-');
  //   var name = parameterize(crawlerId + ' ' + scope + ' ' + path);
  //   fs.writeFile(__dirname + '/test_data/' + name + '.html', nockObject.response);
  // });

  fs.writeFile(__dirname + '/test_data/' + crawlerId + '.nock.json', JSON.stringify(nockObjects, null, 2));
}

function nockPlay(crawlerId) {
  const defs = nock.loadDefs(__dirname + '/test_data/' + crawlerId + '.nock.json')
  
  nock.define(defs);
}

module.exports = function(config, cinemaExpectations) {
  
  if (!config.modules) { config.modules = {}; }

  config.modules.saveCinemaFile = function(cinemaId, data, config, cb) {
    // console.log(JSON.stringify(data, null, 2));
    cinemaExpectations[cinemaId] && cinemaExpectations[cinemaId](expect, data);
    cb();
  };

  describe('', function(x, y) {
    const crawlerId = this.file.match(/test\/(.+).test.js/)[1];

    before(function() {
      try {
        if (process.env.RECORD == 'true') {
          nockRecord(crawlerId);
        } else {
          nockPlay(crawlerId);
        }
      } catch (e) {
        console.log(e);
      }
    });

    after(function() {
      if (process.env.RECORD == 'true') {
        nockSave(crawlerId);
      }
    });

    if (cinemaExpectations) {
      it(crawlerId + ' works', function(done) {
        ultimateCrawler(config, done);
      });      
    } else {
      xit(crawlerId + ' works');
    }

  });

}