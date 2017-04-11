const path = require('path')
const nock = require('nock')
const fs = require('fs')
const projectRootDir = path.resolve('./')
const testDataFolderMain = path.join(projectRootDir, 'test/ultimate-crawler/scripts/test-data')

function saveJsonFile (filePath, data) {
  console.log(`Saving ${filePath} …`)
  fs.writeFile(filePath, JSON.stringify(data, null, 2))
}

function testDataFolderPath (crawlerId) {
  return path.join(testDataFolderMain, crawlerId)
}

/**
 * Load the config(s) for the givin script,
 * adds the crawler id,
 * returns an array of configs
 */
function loadConfigs (script) {
  var crawlerId = script.split('/').reverse()[0].replace('.js', '')

  var configs
  var scriptObj = require(path.join(projectRootDir, script))
  if (scriptObj.configs && scriptObj.configs.constructor === Array) {
    configs = scriptObj.configs
  } else if (scriptObj.config && scriptObj.config.constructor === Object) {
    configs = [scriptObj.config]
  } else if (Object.keys(scriptObj).filter((key) => key.match(/^cinema/)).length > 0) {
    configs = [scriptObj]
  } else {
    throw new Error(`no config found in ${script}`)
  }

  configs.forEach((config) => {
    config.crawler = config.crawler || {}
    config.crawler.id = crawlerId
  })

  return configs
}

module.exports = {
  ultimateCrawler: require(path.join(projectRootDir, 'ultimate-crawler.js')),
  projectRootDir: projectRootDir,
  testDataFolderPath: testDataFolderPath,
  testOutputFolderPath: (crawlerId) => path.join(testDataFolderPath(crawlerId), 'output'),
  testConfigPath: (crawlerId) => path.join(testDataFolderPath(crawlerId), 'test-config.json'),
  saveJsonFile: saveJsonFile,
  loadConfigs: loadConfigs,

  nock: {
    startRecording: function () {
      if (nock.isActive()) {
        nock.recorder.rec({
          dont_print: true,
          output_objects: true
        })
      }
    },
    saveRecording: function (crawlerId) {
      var nockObjects = nock.recorder.play()
      saveJsonFile(path.join(testDataFolderPath(crawlerId), 'http-responses.nock.json'), nockObjects)
    },
    replay: function (crawlerId) {
      const defs = nock.loadDefs(path.join(testDataFolderPath(crawlerId), 'http-responses.nock.json'))
      nock.define(defs)
    }
  }

}
