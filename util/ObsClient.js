const ObsClient = require('esdk-obs-nodejs')

const obsClient = new ObsClient({
    access_key_id: '94WAVW60YMV7C0BPHRZG', // 配置AK
    secret_access_key: '7TfyFvPEJ9D8gRlVhusAlXoQAf2BXTqqE68mnKGE', // 配置SK
    server : 'https://obs.af-south-1.myhuaweicloud.com', // 配置服务地址
    max_retry_count : 1,
    timeout : 20,
    ssl_verify : false,
    long_conn_param : 0
})

const uploadFile2Obs = async (fileKey, filePath, cb) => {
    await obsClient.putObject({
        Bucket : 'zhongtan',
        Key : fileKey,
        SourceFile : filePath
    }).then((result) => {
        if(result.CommonMsg.Status < 300){
            if(result.InterfaceResult){
                cb({
                    'code': '0',
                    'fileKey': fileKey,
                    'versionId': result.InterfaceResult.VersionId
                })
            }
        }else {
            cb({
                'code': result.CommonMsg.Code,
                'message': result.CommonMsg.Message
            })
        }
    }).catch((err) => {
        cb({
            'code': '1',
            'message': err
        })
    })
}

const downloadFile2Obs = async (fileKey, versionId, cb) => {
    obsClient.getObject({
        Bucket : 'zhongtan',
        Key : fileKey,
        VersionId: versionId,
        SaveAsStream: true
    }).then((result) => {
        if(result.CommonMsg.Status < 300){
            if(result.InterfaceResult){
                result.InterfaceResult.Content.on('data', (data) => { 
                    cb({
                        'code': '0',
                        'fileKey': fileKey,
                        'versionId': result.InterfaceResult.VersionId,
                        'contentType': result.InterfaceResult.ContentType,
                        'content': result.InterfaceResult.Content,
                        'data': data
                    })
                })
                
            }
        }else {
            cb({
                'code': result.CommonMsg.Code,
                'message': result.CommonMsg.Message
            })
        }
    }).catch((err) => {
        cb({
            'code': '1',
            'message': err
        })
    })
}

module.exports = {
    uploadFile2Obs: uploadFile2Obs,
    downloadFile2Obs: downloadFile2Obs
  }