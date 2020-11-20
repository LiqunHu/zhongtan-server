const model = require('../app/model')
const mailer = require('../util/Mail')
const GLBConfig = require('../util/GLBConfig')
const tb_edi_depot = model.zhongtan_edi_depot

const readEdiMail = async () => {
  try{
    let ediDepots = await tb_edi_depot.findAll({
      where: {
        state : GLBConfig.ENABLE,
      }
    })

    if(ediDepots && ediDepots.length > 0) {
      await mailer.readEdiMail(ediDepots)
    }
  } finally {
    // continue regardless of error
  }
}

module.exports = {
  readEdiMail: readEdiMail
}