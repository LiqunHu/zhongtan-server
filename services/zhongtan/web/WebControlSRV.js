const moment = require('moment')
const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const logger = require('../../../util/Logger').createLogger('BookingSRV')
const model = require('../../../model')
const FileSRV = require('../../../util/FileSRV')

const tb_web_article = model.zhongtan_web_article

exports.WebControlResource = (req, res) => {
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

    let queryStr =
      'select * from tbl_zhongtan_web_article where state = "1" and web_article_type = "1" order by created_at desc'
    let replacements = []

    let result = await model.queryWithCount(req, queryStr, replacements)

    returnData.total = result.count
    returnData.rows = result.data

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
    let fileInfo = await FileSRV.fileSave(req)
    common.sendData(res, {
      uploadurl: fileInfo.url
    })
  } catch (error) {
    common.sendFault(res, error)
    return
  }
}

async function mddeleteAct(req, res) {
  try {
    let doc = common.docValidate(req)
    // await FileSRV.fileDeleteByUrl('/files/upload/2018/11/14/aa596f6d-c073-4090-8f76-e790fc59f29c.jpg')

    common.sendData(res)
  } catch (error) {
    common.sendFault(res, error)
    return
  }
}
