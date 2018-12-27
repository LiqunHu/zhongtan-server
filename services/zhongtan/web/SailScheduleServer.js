const moment = require('moment')
const common = require('../../../util/CommonUtil')
const logger = require('../../../app/logger').createLogger(__filename)
const model = require('../../../app/model')

const tb_sail_schedule_upload = model.zhongtan_sail_schedule_upload
const tb_uploadfile = model.zhongtan_uploadfile

exports.initAct = async () => {
  return common.success()
}

exports.searchAct = async req => {
  let returnData = {}

  let queryStr = 'select * from tbl_zhongtan_sail_schedule_upload where state = "1" order by created_at desc'
  let replacements = []

  let result = await model.queryWithCount(req, queryStr, replacements)

  returnData.total = result.count
  returnData.rows = []

  for (let d of result.data) {
    let files = await tb_uploadfile.findAll({
      where: {
        api_name: common.getApiName(req.path),
        uploadfile_index1: d.sail_schedule_upload_id
      }
    })
    d.publish_date = moment(d.created_at).format('YYYY-MM-DD')
    d.files = []
    for (let f of files) {
      d.files.push({
        file_id: f.uploadfile_id,
        url: f.uploadfile_url,
        name: f.uploadfile_name
      })
    }
    returnData.rows.push(d)
  }

  logger.debug(returnData)
  return common.success(returnData)
}

exports.addAct = async req => {
  let doc = common.docValidate(req),
    user = req.user
  let ssu = await tb_sail_schedule_upload.create({
    sail_schedule_upload_desc: doc.sail_schedule_upload_desc
  })

  for (let f of doc.files) {
    let mv = await common.fileSave(req, 'zhongtan')
    await tb_uploadfile.create({
      api_name: common.getApiName(req.path),
      user_id: user.user_id,
      uploadfile_index1: ssu.sail_schedule_upload_id,
      uploadfile_name: f.name,
      uploadfile_url: mv.url
    })
  }
  return common.success()
}

exports.deleteAct = async req => {
  let doc = common.docValidate(req)

  let ssu = await tb_sail_schedule_upload.findOne({
    where: {
      sail_schedule_upload_id: doc.sail_schedule_upload_id
    }
  })

  // let files = await tb_uploadfile.findAll({
  //   where: {
  //     api_name: common.getApiName(req.path),
  //     uploadfile_index1: ssu.sail_schedule_upload_id
  //   }
  // })

  // for (let f of files) {
  //   FileSRV.fileDeleteByUrl(f.uploadfile_url)
  //   f.destroy()
  // }
  ssu.destroy()

  return common.success()
}

exports.uploadAct = async req => {
  let fileInfo = await common.fileSave(req, 'zhongtan')
  return common.success(fileInfo)
}
