var expect = require('expect.js');

expect.Assertion.prototype._contain = function(obj) {
  this.assert(
    (_.findWhere(this.obj, obj) !== undefined), function() {
      return 'expected ' + expect.stringify(this.obj) + ' to contain ' + expect.stringify(obj)
    }, function() {
      return 'expected ' + expect.stringify(this.obj) + ' to not contain ' + expect.stringify(obj)
    });
  return this;
};