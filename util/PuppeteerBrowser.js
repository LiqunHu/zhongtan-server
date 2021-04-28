const puppeteer = require('puppeteer')

let browser = null

const getBrowser = async () => {
  if (browser) {
    return browser
  } else {
    // browser = await puppeteer.launch({ headless: false })
    browser = await puppeteer.launch({args: ['--no-sandbox', '--disable-setuid-sandbox']})

    return browser
  }
}

const close = async () => {
  if (browser) {
    await browser.close()
    browser = null
  }
}

module.exports = {
  getBrowser: getBrowser,
  close: close
}
