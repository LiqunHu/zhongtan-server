const nodemailer = require('nodemailer')

const config = require('../app/config')

const transporter = nodemailer.createTransport(config.mailConfig)

const sendMail = async (to, subject, text, html) => {
  let info = await transporter.sendMail({
    from: config.mailConfig.sender, // sender address
    to: to, // list of receivers
    subject: subject || '', // Subject line
    text: text || '', // plain text body
    html: html || '' // html body
  })
  return info
}

module.exports = {
  sendMail: sendMail
}
