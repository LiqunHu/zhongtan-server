const moment = require('moment')
const common = require('../../../util/CommonUtil')
const FileSRV = require('../../../util/FileSRV')
const GLBConfig = require('../../../util/GLBConfig')
const logger = require('../../../util/Logger').createLogger('SailScheduleControl')
const model = require('../../../model')

const tb_sail_schedule_upload = model.zhongtan_sail_schedule_upload
const tb_uploadfile = model.zhongtan_uploadfile

exports.SailScheduleControlResource = (req, res) => {
  let method = common.reqTrans(req, __filename)
  if (method === 'init') {
    initAct(req, res)
  } else if (method === 'search') {
    searchAct(req, res)
  } else if (method === 'add') {
    addAct(req, res)
  } else if (method === 'delete') {
    deleteAct(req, res)
  } else if (method === 'upload') {
    uploadAct(req, res)
  } else {
    common.sendError(res, 'common_01')
  }
}

async function initAct(req, res) {
  try {
    let doc = common.docValidate(req)
    let user = req.user
    common.sendData(res)
  } catch (error) {
    common.sendFault(res, error)
  }
}

async function searchAct(req, res) {
  try {
    let doc = common.docValidate(req),
      user = req.user,
      returnData = {}

    let queryStr =
      'select * from tbl_zhongtan_sail_schedule_upload where state = "1" order by created_at desc'
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

    common.sendData(res, returnData)
  } catch (error) {
    common.sendFault(res, error)
  }
}

async function addAct(req, res) {
  try {
    let doc = common.docValidate(req),
      user = req.user
    let ssu = await tb_sail_schedule_upload.create({
      sail_schedule_upload_desc: doc.sail_schedule_upload_desc
    })

    for (let f of doc.files) {
      let mv = await FileSRV.fileMove(f.url)
      await tb_uploadfile.create({
        api_name: common.getApiName(req.path),
        user_id: user.user_id,
        uploadfile_index1: ssu.sail_schedule_upload_id,
        uploadfile_name: f.name,
        uploadfile_url: mv.url
      })
    }
    common.sendData(res)
  } catch (error) {
    common.sendFault(res, error)
    return
  }
}

async function deleteAct(req, res) {
  try {
    let doc = common.docValidate(req)

    let ssu = await tb_sail_schedule_upload.findOne({
      where: {
        sail_schedule_upload_id: doc.sail_schedule_upload_id
      }
    })

    let files = await tb_uploadfile.findAll({
      where: {
        api_name: common.getApiName(req.path),
        uploadfile_index1: ssu.sail_schedule_upload_id
      }
    })

    for(let f of files){
      FileSRV.fileDeleteByUrl(f.uploadfile_url)
      f.destroy()
    }

    ssu.destroy()

    common.sendData(res)
  } catch (error) {
    common.sendFault(res, error)
    return
  }
}

async function uploadAct(req, res) {
  try {
    let fileInfo = await FileSRV.fileSaveTemp(req)
    common.sendData(res, fileInfo)
  } catch (error) {
    common.sendFault(res, error)
    return
  }
}
