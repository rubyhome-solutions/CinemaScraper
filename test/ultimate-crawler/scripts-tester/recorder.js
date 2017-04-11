const fs = require('fs')
const path = require('path')
const moment = require('moment')
const helper = require('./helper')
const async = require('async')
const colors = require('colors')

function doesTestDataFolderExist (crawlerId) {
  var folderPath = helper.testDataFolderPath(crawlerId)
  return fs.existsSync(folderPath)
}

function createTestDataFolder (crawlerId) {
  fs.mkdirSync(helper.testDataFolderPath(crawlerId))
  fs.mkdirSync(helper.testOutputFolderPath(crawlerId))
}

function saveTestConfig (crawlerId) {
  helper.saveJsonFile(helper.testConfigPath(crawlerId), {
    testDate: moment().format()
  })
}

function recordTest (script) {
  var configs = helper.loadConfigs(script)
  var crawlerId = configs[0].crawler.id

  if (doesTestDataFolderExist(crawlerId)) {
    console.error(`TestData already recorded: Delete '${helper.testDataFolderPath(crawlerId)}' to record from scratch.`)
    process.exit(1)
  }

  createTestDataFolder(crawlerId)
  configs.forEach((config) => {
    config.outputDir = helper.testOutputFolderPath(crawlerId)
  })

  helper.nock.startRecording()

  async.eachSeries(configs, helper.ultimateCrawler.crawl, (err) => {
    if (err) {
      console.error(err)
    } else {
      console.log('Finished crawling')
      helper.nock.saveRecording(crawlerId)
      saveTestConfig(crawlerId)

      var fileContent = fs.readFileSync(path.join(path.resolve(), script), 'utf8')
      var searchMoment = `require('moment')`
      if (fileContent.indexOf(searchMoment) > 0) { 
        console.warn(`Found ${searchMoment} in crawler script. Therefore the test case will likely not run in the future without adjustments to ensure the _testBaseDate is used properly.`)
        console.log(`Please check ${script} for calls of ${colors.cyan('moment()')} and consider replacing it with ${colors.cyan('moment(config._testBaseDate)')}. This may require moving inline functions outside the config object.`)
      }
    }
  })
}

function existingTests () {
  var testDataFolder = helper.testDataFolderPath('')
  return fs.readdirSync(testDataFolder).filter((file) => file.indexOf('.') === -1)
}

module.exports = {
  recordTest: recordTest,
  existingTests: existingTests
}
