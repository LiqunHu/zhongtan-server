const moment = require('moment')
const common = require('../../../util/CommonUtil')
const GLBConfig = require('../../../util/GLBConfig')
const logger = require('../../../util/Logger').createLogger('BookingSRV')
const MarkdownIt = require('../../../util/markdown.js')
const model = require('../../../model')

const tb_web_article = model.zhongtan_web_article

exports.WebResource = (req, res) => {
  let method = common.reqTrans(req, __filename)
  if (method === 'getHomePageBoard') {
    getHomePageBoardAct(req, res)
  } else if (method === 'getMessages') {
    getMessagesAct(req, res)
  } else if (method === 'getArticle') {
    getArticleAct(req, res)
  } else {
    common.sendError(res, 'common_01')
  }
}

async function getHomePageBoardAct(req, res) {
  try {
    let returnData = {
      data: {
        message: [],
        schedule: []
      }
    }

    let messages = await tb_web_article.findAll({
      where: {
        web_article_type: '1'
      },
      limit: 5,
      order: [['created_at', 'DESC']]
    })
    for (let m of messages) {
      returnData.data.message.push({
        web_article_id: m.web_article_id,
        web_article_title: m.web_article_title,
        created_at: moment(m.created_at).format('YYYY/MM/DD')
      })
    }

    common.sendData(res, returnData)
  } catch (error) {
    common.sendFault(res, error)
  }
}

async function getMessagesAct(req, res) {
  try {
    let returnData = {
      data: {
        messages: []
      }
    }

    let messages = await tb_web_article.findAll({
      where: {
        web_article_type: '1'
      },
      order: [['created_at', 'DESC']]
    })

    for (let m of messages) {
      returnData.data.messages.push({
        web_article_id: m.web_article_id,
        web_article_title: m.web_article_title,
        created_at: moment(m.created_at).format('YYYY/MM/DD')
      })
    }

    common.sendData(res, returnData)
  } catch (error) {
    common.sendFault(res, error)
  }
}

async function getArticleAct(req, res) {
  try {
    let doc = common.docValidate(req)

    let article = await tb_web_article.findOne({
      where: {
        web_article_id: doc.web_article_id
      }
    })

    let returnData = JSON.parse(JSON.stringify(article))

    returnData.web_article_markdown = MarkdownIt.render(returnData.web_article_body)
    returnData.created_at = moment(article.created_at).format('YYYY/MM/DD')
    common.sendData(res, returnData)
  } catch (error) {
    common.sendFault(res, error)
  }
}
