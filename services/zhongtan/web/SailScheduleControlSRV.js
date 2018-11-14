const moment = require('moment')
const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const logger = require('../../../util/Logger').createLogger('BookingSRV')
const model = require('../../../model')

const tb_sail_schedule_upload = model.zhongtan_sail_schedule_upload
const tb_uploadfile = model.uploadfile

exports.SailScheduleControlResource = (req, res) => {
  let method = common.reqTrans(req, __filename)
  if (method === 'init') {
    initAct(req, res)
  } else if (method === 'search') {
    searchAct(req, res)
  } else if (method === 'add') {
    addAct(req, res)
  } else if (method === 'modify') {
    modifyAct(req, res)
  } else if (method === 'delete') {
    deleteAct(req, res)
  } else if (method === 'mdupload') {
    mduploadAct(req, res)
  } else if (method === 'mddelete') {
    mddeleteAct(req, res)
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

    let queryStr = 'select * from tbl_zhongtan_sail_schedule_upload where state = "1" order by created_at desc'
    let replacements = []

    let result = await model.queryWithCount(req, queryStr, replacements)

    returnData.total = result.count
    returnData.rows = []

    for(let d of result.data) {
      let files = await tb_uploadfile.findAll({
        where: {
          api_name: common.getApiName(req.path),
          uploadfile_index1: d.sail_schedule_upload_id
        }
      })
      d.files = []
      for(let f of files) {
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
    let doc = common.docValidate(req)
    if (!doc.web_article_img) {
      doc.web_article_img = ''
    }

    let article = await tb_web_article.create({
      web_article_type: '1',
      web_article_title: doc.web_article_title,
      web_article_author: doc.web_article_author,
      web_article_body: doc.web_article_body,
      web_article_img: doc.web_article_img
    })
    common.sendData(res, article)
  } catch (error) {
    common.sendFault(res, error)
    return
  }
}

async function modifyAct(req, res) {
  try {
    let doc = common.docValidate(req)

    let article = await tb_web_article.findOne({
      where: {
        web_article_id: doc.old.web_article_id
      }
    })
    article.web_article_title = doc.new.web_article_title
    article.web_article_author = doc.new.web_article_author
    article.web_article_body = doc.new.web_article_body
    await article.save()

    common.sendData(res, article)
  } catch (error) {
    common.sendFault(res, error)
    return null
  }
}

async function deleteAct(req, res) {
  try {
    let doc = common.docValidate(req)

    let article = await tb_web_article.findOne({
      where: {
        web_article_id: doc.web_article_id
      }
    })

    article.destroy()

    common.sendData(res)
  } catch (error) {
    common.sendFault(res, error)
    return
  }
}

async function mduploadAct(req, res) {
  try {
    let uploadurl = await common.fileSave(req)
    let fileUrl = await common.fileMove(uploadurl.url, 'upload')
    common.sendData(res, {
      uploadurl: fileUrl
    })
  } catch (error) {
    common.sendFault(res, error)
    return
  }
}

async function mddeleteAct(req, res) {
  try {
    let doc = common.docValidate(req)
    await common.fileRemove(doc.file_url)

    common.sendData(res)
  } catch (error) {
    common.sendFault(res, error)
    return
  }
}
