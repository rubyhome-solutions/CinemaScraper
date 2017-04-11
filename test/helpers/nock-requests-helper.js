var nock = require('nock');
var fs = require('fs');
var testDataDir = __dirname + '/../../test_data/';


function nockRecord() {
  nock.recorder.rec({
    dont_print: true,
    output_objects: true
  });  
}

function nockSave(nockId) {
  var nockObjects = nock.recorder.play();
  fs.writeFile(testDataDir + nockId + '.nock.json', JSON.stringify(nockObjects, null, 2));
}

function nockPlay(nockId) {
  const defs = nock.loadDefs(testDataDir + nockId + '.nock.json')
  nock.define(defs);
}

module.exports = function(nockId){
  return {
    before: function () {
      if (process.env.RECORD == 'true') {
        nockRecord(nockId);
      } else {
        nockPlay(nockId);
      }
    },
    after: function () {
      if (process.env.RECORD == 'true') {
        nockSave(nockId);
      }
    }  
  }  
}