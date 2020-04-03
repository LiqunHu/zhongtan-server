const nodemailer = require('nodemailer')

const config = require('../app/config')

const transporter = nodemailer.createTransport(config.mailConfig)

const sendMail = async (to, subject, text, html) => {
  let info = await transporter.sendMail({
    from: config.mailConfig.sender, // sender address
    to: to, // list of receivers
    subject: subject || '', // Subject line
    text: text || '', // plain text body
    html: html || ''
  })
  return info
}

const sendEdiMail = async (from, to, cc, bcc, subject, text, html, attachments) => {
  let info = await transporter.sendMail({
    from: from, // sender address
    to: to, // list of receivers
    cc: cc, // list of Carbon Copy
    bcc: bcc, // list of Blind Carbon Copy
    subject: subject || '', // Subject line
    text: text || '', // plain text body
    html: html || '',
    attachments: attachments // html body
  })
  return info
}

module.exports = {
  sendMail: sendMail,
  sendEdiMail: sendEdiMail
}
