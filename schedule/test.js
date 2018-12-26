const logger = require('../app/logger').createLogger(__filename)

const test = () => {
  logger.info(444444444)
}


module.exports = {
  test: test
}
