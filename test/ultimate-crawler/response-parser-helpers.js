const expect = require('expect.js')
const helpers = require('./../../ultimate-crawler/response-parser-helpers')
const ConfigError = require('./../../ultimate-crawler/config-error')
const moment = require('moment')

describe('ultimate crawler helpers', function () {
  
  describe('#cleanMovieTitle', function () {
    it('removes `(OV)`', () => expect(helpers.cleanMovieTitle('Awesome Movie (OV)')).to.be('Awesome Movie'))
    it('trims whitespace', () => expect(helpers.cleanMovieTitle(' Awesome Movie ')).to.be('Awesome Movie'))
  })

  describe('#formatStartAt', function () {
    it('returns `undefined` if no timeString is given', function () {
      expect(helpers.formatStartAt('2016-11-28', null, {})).to.be(undefined)
      expect(helpers.formatStartAt('2016-11-28', undefined, {})).to.be(undefined)
    })

    it('throws ConfigError if showtimeFormat is not configured', function () {
      var fn = function () { helpers.formatStartAt('2016-11-28', '13:37', {}) }
      expect(fn).to.throwException(function (e) { // get the exception object
        expect(e).to.be.a(ConfigError)
      })
    })

    it('parses DE format as of cineprog', function () {
      var config = {
        dateFormat: 'DD.MM',
        showtimeFormat: 'HH:mm'
      }
      expect(helpers.formatStartAt('Mi 04.05.', '22:00', config)).to.be(moment().format('YYYY') + '-05-04T22:00:00')
    })

    it('uses ISO 8601 formatted dates with timestamp as is', function() {
      var config = {
        showtimeFormat: 'YYYY-MM-DDTHH:mm:ssZ'
      }
      expect(helpers.formatStartAt(null, '2017-01-14T17:30:00+01:00', config)).to.be('2017-01-14T17:30:00+01:00')
      expect(helpers.formatStartAt(null, '2017-01-14T17:30:00-01:00', config)).to.be('2017-01-14T17:30:00-01:00')
    })

  })

  describe('#parseLanguageText', function () {
    it('throws ConfigError if subtitlesMap is not configured', function () {
      var fn = function () { helpers.parseLanguageText('Awesome Movie', {}) }
      expect(fn).to.throwException(function (e) { // get the exception object
        expect(e).to.be.a(ConfigError)
      })
    })

    var config = {
      languageMap: {
        'English': 'en',
        'French': 'fr'
      }
    }

    it('finds en language', () => expect(helpers.parseLanguageText('Awesome Movie (in English)', config)).to.be('en'))
    it('finds fr language', () => expect(helpers.parseLanguageText('Awesome Movie (in French)', config)).to.be('fr'))
    it('returns `undefined` if no subtitles found', () => expect(helpers.parseLanguageText('Awesome Movie', config)).to.be(undefined))

  })


  describe('#parseSubtitlesText', function() {
    it('throws ConfigError if subtitlesMap is not configured', function () {
      var fn = function () { helpers.parseSubtitlesText('Awesome Movie', {}) }
      expect(fn).to.throwException(function (e) { // get the exception object
        expect(e).to.be.a(ConfigError)
      })
    })

    var config = {
      subtitlesMap: {
        SUBTITLED: 'en'
      }
    }

    it('finds subtitles', () => expect(helpers.parseSubtitlesText('Awesome Movie SUBTITLED', config)).to.be('en'))
    it('returns `undefined` if no subtitles found', () => expect(helpers.parseSubtitlesText('Awesome Movie', config)).to.be(undefined))
    
  })

  describe('#parseVersionFlags', function() {
    [null, undefined].forEach((input) => {
      context(`${input}`, () => {
        it('returns object with flags set to false', () => {
          var flags = helpers.parseVersionFlags(input)
          expect(flags.is_3d).to.be(false)
          expect(flags.is_imax).to.be(false)
        })
      })
    })

    context('3D IMAX', () => {
      var flags = helpers.parseVersionFlags('3D IMAX')
      it('matches 3D', () => expect(flags.is_3d).to.be(true))
      it('matches 3d', () => expect(flags.is_3d).to.be(true))
      it('matches IMAX', () => expect(flags.is_imax).to.be(true))
      it('matches imax', () => expect(flags.is_imax).to.be(true))
    })
    context('2D', () => {
      var flags = helpers.parseVersionFlags('2D')
      it('not matches 3D', () => expect(flags.is_3d).to.be(false))
      it('not matches IMAX', () => expect(flags.is_imax).to.be(false))
    })
  })

})