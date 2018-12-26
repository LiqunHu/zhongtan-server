const mongoClient = require('server-utils').mongoClient

const common = require('../util/CommonUtil.js')

const FileResource = async (req, res) => {
  try {
    let bucketName = req.params.bucket
    let fileName = req.params.filetag

    let bucket = mongoClient.getBucket(bucketName)
    let downloadStream = bucket.openDownloadStreamByName(fileName)

    res.type(req.params.filetag)
    downloadStream.pipe(res)
  } catch (error) {
    common.sendFault(res, error)
  }
}

module.exports = {
  FileResource: FileResource
}
