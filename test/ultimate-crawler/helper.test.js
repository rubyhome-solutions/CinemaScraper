const expect = require('chai').expect
const helper = require('./../../ultimate-crawler/helper')

describe('helper', () => {

  describe('#isLinkTagSelector', () => {
    context('nullably values', () => {
      [null, undefined].forEach((input) => {
        it(`returns false for ${input}`, () => expect(helper.isLinkTagSelector(input)).to.equal(false))
      })
    })

    context('positive cases', () => {
      [
        '.col-2 a',
        'a.link2',
        '> a',
        '.sesList .horiList li a',
        'tr.tableBack:nth-of-type(1) td a',
        '.TheatreFinder-links a:nth-of-type(2)'
      ].forEach((input) => {
        it(`returns true for '${input}'`, () => expect(helper.isLinkTagSelector(input)).to.equal(true))
      })
    })

    context('negative cases', () => {
      [
        '',
        'td:nth-of-type(1) p:nth-of-type(1)',
        '.horarios'
      ].forEach((input) => {
        it(`returns false for '${input}'`, () => expect(helper.isLinkTagSelector(input)).to.equal(false))
      })
    })
  })

})

