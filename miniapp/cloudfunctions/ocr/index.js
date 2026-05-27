// OCR - 腾讯云 OCR base64 直调
const cloud = require('wx-server-sdk')
const crypto = require('crypto')
const https = require('https')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const SID=process.env['TENCENT_SECRET_ID']||''
const SKEY=process.env['TENCENT_SECRET_KEY']||''

function sign(svc, act, payload, ts) {
  const d = new Date(ts*1000).toISOString().slice(0,10)
  const ch = 'content-type:application/json\nhost:'+svc+'.tencentcloudapi.com\n'
  const hp = crypto.createHash('sha256').update(payload).digest('hex')
  const cr = 'POST\n/\n\n'+ch+'\ncontent-type;host\n'+hp
  const cs = d+'/'+svc+'/tc3_request'
  const hr = crypto.createHash('sha256').update(cr).digest('hex')
  const sts = 'TC3-HMAC-SHA256\n'+ts+'\n'+cs+'\n'+hr
  const kd = crypto.createHmac('sha256','TC3'+SKEY).update(d).digest()
  const ks = crypto.createHmac('sha256',kd).update(svc).digest()
  const kw = crypto.createHmac('sha256',ks).update('tc3_request').digest()
  const sig = crypto.createHmac('sha256',kw).update(sts).digest('hex')
  return 'TC3-HMAC-SHA256 Credential='+SID+'/'+cs+', SignedHeaders=content-type;host, Signature='+sig
}

function callOCR(act, b64) {
  return new Promise((r,j) => {
    const payload = JSON.stringify({ImageBase64:b64})
    const ts = Math.floor(Date.now()/1000)
    const req = https.request({
      hostname:'ocr.tencentcloudapi.com', path:'/', method:'POST',
      headers:{
        'Content-Type':'application/json',
        Authorization:sign('ocr',act,payload,ts),
        'X-TC-Action':act, 'X-TC-Version':'2018-11-19',
        'X-TC-Timestamp':ts, 'X-TC-Region':'ap-guangzhou'
      },
      timeout:12000
    }, res => {
      let d=''; res.on('data',c=>d+=c); res.on('end',()=>{
        const jj=JSON.parse(d)
        if(jj.Response.Error) return j(new Error(jj.Response.Error.Message))
        r((jj.Response.TextDetections||[]).map(i=>i.DetectedText).join('\n'))
      })
    })
    req.on('error',e=>j(e))
    req.on('timeout',()=>{req.destroy();j(new Error('超时'))})
    req.write(payload); req.end()
  })
}

exports.main = async (event) => {
  const { fileID } = event
  if(!fileID) return {error:'缺少图片'}
  if(!SID||!SKEY) return {error:'未配置腾讯云密钥'}

  try {
    const res = await cloud.downloadFile({fileID})
    const b64 = res.fileContent.toString('base64')

    let text = ''
    try { text = await callOCR('GeneralBasicOCR', b64) }
    catch(e) {
      try { text = await callOCR('GeneralHandwritingOCR', b64) }
      catch(e2) { throw e2 }
    }

    if(!text.trim()) return {error:'未识别到文字'}
    return {text:text.trim(), length:text.trim().length}
  } catch(err) {
    return {error:err.message||'OCR失败'}
  }
}
