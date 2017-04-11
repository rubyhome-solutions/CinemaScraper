const fs = require('fs')
const path = require('path')
const _ = require('underscore')
const ConfigError = require('./config-error')
const tv4 = require('tv4')
const schema = require('./config-schema')

function validateConfig (config) {
  if (!tv4.validate(config, schema)) {
    console.error('Config validation failed: %s at %s', tv4.error.message, tv4.error.dataPath)
    throw new ConfigError(tv4.error)
  }


  var curDir = __dirname

  var files = fs.readdirSync(curDir)
                .filter((fileName) => fileName.match(/\.js$/))
                .map((fileName) => curDir + '/' + fileName)
                .concat(curDir + '/../ultimate-crawler.js')

  var knownConfigKeys = _.chain(files)
                         .map((file) => {
                           var fileContent = fs.readFileSync(file, 'utf8')
                           var codedKeys = (fileContent.match(/config\.\w+/g) || []).map((key) => key.substring(7))
                           var dynamicSelectKeys = _.chain(fileContent.match(/.+selectValueFromNode.+/g) || [])
                                                    .select((key) => {
                                                      return !key.match(/function/) &&
                                                             !key.match(/var dynamicSelectKeys/)
                                                    })
                                                    .map((key) => key.split(',')[1].replace(/'/g, '').trim())
                                                    .map((key) => [key + 'Selector', key + 'Attribute', key + 'Parser'])
                                                    .flatten()
                                                    .value()
                           var dynamicCinemaParserKeys = _.chain(fileContent.match(/.+parseCinemaValue.+/g) || [])
                                                    .select((key) => {
                                                      return !key.match(/function/) &&
                                                             !key.match(/var dynamicCinemaParserKeys/)
                                                    })
                                                    .map((key) => key.split(',')[1].replace(/'/g, '').trim())
                                                    .map((key) => 'cinema' + key.capitalize() + 'Parser')
                                                    .flatten()
                                                    .value()
                           return codedKeys.concat(dynamicSelectKeys, dynamicCinemaParserKeys)
                         })
                         .flatten()
                         .uniq()
                         .sort()
                         .value()

  knownConfigKeys.push('crawlerId')
  knownConfigKeys = knownConfigKeys.concat(Object.keys(schema.properties))
  // console.log(knownConfigKeys)

  _.difference(Object.keys(config), knownConfigKeys).forEach(function (key) {
    console.warn('Found unknown key in crawler config: %s', key)
  })
}

function validateKeyIsSet (key, config) {
  if (!config[key]) {
    throw new ConfigError(`${key} is missing in config`)
  }
}

module.exports = {
  validateConfig: validateConfig,
  validateKeyIsSet: validateKeyIsSet
}
