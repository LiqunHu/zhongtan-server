const path = require('path')
const fs = require('fs')
const Imap = require('imap')
const MailParser = require('mailparser').MailParser
const config = require('../app/config')
const model = require('../app/model')
const GLBConfig = require('../util/GLBConfig')
const bookingLoad = require('../services/zhongtan/export/BookingLoadServer')
const logger = require('../app/logger').createLogger(__filename)

const tb_container_size = model.zhongtan_container_size

const imap = new Imap({
  user: config.mailConfig.auth.user,
  password: config.mailConfig.auth.pass,
  host: config.mailConfig.host,
  port: 993,
  tls: true
})

const readBookingMail = async () => {
  logger.error("开始读取Booking邮件吧")
  let mailData = await readNewMail()
  if(mailData && mailData.length > 0) {
    logger.error("我读到邮件了")
    let f = imap.fetch(mailData, { bodies: ''})
    if(f) {
      logger.error("我读到邮件了111111")
      f.on('message', function(msg) {
        logger.error("我读到邮件了2222222")
        let mailparser = new MailParser()
        msg.on('body', function(stream) {
          logger.error("我读到邮件了33333333333")
          stream.pipe(mailparser)
          mailparser.on("headers", function(headers){
            logger.error("我读到邮件了4444444444444")
            let from = headers.get('from').text
            let subject = headers.get('subject')
            logger.error("我读到邮件了5555555555555")
            logger.error(from)
            logger.error(subject)
            if(from === 'PLEASE-No-Reply-IRIS-4@COSCON.com' || from === 'PLEASE-No-Reply-IRIS-4@OOCL.COM') {
              mailparser.on("data", function(data) {
                logger.error("我读到邮件了666666666666666")
                if (data.type === 'attachment') {
                  logger.error("我读到邮件了7777777777777777")
                  let filePath = path.join(process.cwd(), config.fileSys.filesDir, data.filename)
                  let writeStream = fs.createWriteStream(filePath)
                  data.content.pipe(writeStream)
                  data.release()
                  writeStream.on('finish', async () => {
                    logger.error("我读到邮件了888888888888888888888")
                    if(fs.existsSync(filePath)) {
                      let sizeConfig = await tb_container_size.findAll({
                        where: {
                          state: GLBConfig.ENABLE
                        }
                      })
                      logger.error("读取到邮件了" + from + ', ' + subject + ',' + data.filename)
                      await bookingLoad.importBookingPdf(filePath, sizeConfig)
                    }
                  })
                }
              })
            }
          })
        })
      })
    }
  } else{
    logger.error("我没有读到邮件")
  }
}

const readNewMail = async () => {
  let mailData = []
  let promise = new Promise(resolve => {
    imap.once('ready', function() {
      if(imap.state != 'authenticated') {
        imap.connect()
      }
      imap.openBox('INBOX', false, function(err) {
        if (err) {
          imap.end()
        }
        imap.search(['NEW'], function(err, results) {
          if (err) {
            imap.end()
          }
          if(results && results.length > 0) {
            imap.setFlags(results, ['\\Seen'], function(err) {
              if (err) {
                imap.end()
              }
            })
          }else {
            imap.end()
          }
          resolve(results)
        })
      })
    })
    imap.on('error', function() {
      imap.end()
    })
    imap.once('end', function() {
    })
    imap.connect()
  })
  await promise.then((data) => {
    mailData = data
  })
  return mailData
}

module.exports = {
  readBookingMail: readBookingMail
}