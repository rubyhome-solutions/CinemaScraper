var assert = require('assert'),
  expect = require('expect.js'),
  utils = require('./../utils')

describe('utils', function () {
  describe('#urlToFilename', function () {
    var testValues = [{
      testInput: 'http://www.movieland.co.uk/',
      expectedOutput: 'uk-co-movieland'
    }, {
      testInput: 'http://www.cineplex.de/',
      expectedOutput: 'de-cineplex'
    }, {
      testInput: 'http://cineplex.de/',
      expectedOutput: 'de-cineplex'
    }, {
      testInput: 'http://www.movies-at.ie/index.php?__site=M-DUNDRUM',
      expectedOutput: 'ie-movies-at_m-dundrum'
    }, {
      testInput: 'http://www.filmweb.no/flekkefjordkino/',
      expectedOutput: 'no-filmweb_flekkefjordkino'
    }, ]

    testValues.forEach(function (testValue) {
      it('handles `' + testValue.testInput + '`', function () {
        expect(utils.urlToFilename(testValue.testInput)).to.be(testValue.expectedOutput)
      })
    })
  })

  describe('#parseLatlonFromGoogleMapsUrl', function () {
    var testValues = [{
      testInput: 'https://maps.google.com/maps?&amp;z=10&amp;q=48.2104349+16.3705994&amp;ll=48.2104349+16.3705994',
      expectedOutput: {lat: 48.2104349, lon: 16.3705994}
    },
      {
        testInput: 'https://maps.google.com/maps?&z=10&q=48.2104349+16.3705994&ll=48.2104349+16.3705994',
        expectedOutput: {lat: 48.2104349, lon: 16.3705994}
      }]

    testValues.forEach(function (testValue) {
      it('handles `' + testValue.testInput + '`', function () {
        expect(utils.parseLatlonFromGoogleMapsUrl(testValue.testInput)).to.eql(testValue.expectedOutput)
      })
    })
  })

  describe('#parseLatlonFromBingMapsUrl', function () {
    var testValues = [{
      testInput: 'https://www.bing.com/maps?v=2&lvl=9&style=r&mode=D&rtop=0~0~0~&cp=40.5872046329~-75.5585015437&rtp=adr.~pos.40.5872046329_-75.5585015437_AMC+Tilghman+Square+8+4608+Broadway+ALLENTOWN+PA+18104-0000',
      expectedOutput: {lat: 40.5872046329, lon: -75.5585015437}
    }]

    testValues.forEach(function (testValue) {
      it('handles `' + testValue.testInput + '`', function () {
        expect(utils.parseLatlonFromBingMapsUrl(testValue.testInput)).to.eql(testValue.expectedOutput)
      })
    })
  })
})
