// AI作业批改 - 两阶段：视觉识别 + 文本格式化JSON
// 环境变量：HUNYUAN_API_KEY

const cloud = require('wx-server-sdk')
const https = require('https')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const HOST='api.hunyuan.cloud.tencent.com'
const API_KEY=process.env['HUNYUAN_API_KEY']||''

function callAPI(model, messages, timeout) {
  return new Promise((resolve, reject) => {
  const body = JSON.stringify({model, messages, stream:false})
  const req = https.request({
    hostname:HOST, path:'/v1/chat/completions', method:'POST',
    headers:{Authorization:'Bearer '+API_KEY,'Content-Type':'application/json'},
    timeout: timeout||30000
  }, res => {
    let d=''
    res.on('data',c=>d+=c)
    res.on('end',()=>{
      try {
        const j=JSON.parse(d)
        if(j.error) return reject(new Error(j.error.message||JSON.stringify(j.error)))
        resolve(j.choices[0].message.content)
      } catch(e) { reject(new Error('API响应异常: '+d.slice(0,200))) }
    })
  })
  req.on('error',e=>reject(e))
  req.on('timeout',()=>{req.destroy();reject(new Error('超时'))})
  req.write(body); req.end()
  })
}

exports.main = async (event) => {
  const { fileID, fileIDs, essay } = event
  const allFileIDs = fileIDs || (fileID ? [fileID] : [])
  if(!allFileIDs.length && (!essay||essay.length<10)) return {error:'请拍照或输入至少10字'}
  if(!API_KEY) return {error:'未配置HUNYUAN_API_KEY'}

  try {
    let analysis = ''

    if(allFileIDs.length) {
      // 下载所有图片
      const images = []
      for(const fid of allFileIDs) {
        const r = await cloud.downloadFile({fileID: fid})
        const b64 = r.fileContent.toString('base64')
        const mime = r.fileContent[0]===0xFF ? 'image/jpeg' : 'image/png'
        images.push({type:'image_url', image_url:{url:'data:'+mime+';base64,'+b64}})
      }

      // 处理完立即删图，省存储
      cloud.deleteFile({ fileList: allFileIDs }).catch(() => {})

      const promptText = allFileIDs.length>1
        ? `请批改以下${allFileIDs.length}张试卷图片，把它们当作同一份作业的多页内容。` + essay ? ' 补充说明：'+essay : ''
        : essay ? '请结合说明批改：'+essay : '请批改图片中的学生作业'
      const visionPrompt = promptText + `

第一步：判断学科（语文/数学/英语/物理/化学）。关键特征：
- 数学=数字、方程、几何图形、函数、集合
- 英语=英文单词、英文句子
- 物理=力、电、光、速度、质量等概念
- 化学=化学式、方程式、元素符号
- 语文=中文作文、阅读理解、古诗词

第二步：判断年级（小学/初中/高中）

第三步：逐题批改，指出对错

第四步：总评+分数（满分100）`

      const content = [{type:'text', text:visionPrompt}, ...images]

      analysis = await callAPI('hunyuan-vision', [
        {role:'user', content}
      ], 80000)
    } else {
      analysis = essay
    }

    // 阶段2：文本格式化为JSON
    const jsonPrompt = `将以下作业批改内容转为JSON。
{"subject":"学科","grade":"年级","score":88,"summary":"总评","highlights":["亮点"],"issues":[{"sentence":"原文","suggestion":"建议","reason":"原因"}],"typos":[{"wrong":"错","correct":"正","position":"位置"}]}

批改内容：
${analysis}`

    const raw = await callAPI('hunyuan-turbo', [
      {role:'user', content:jsonPrompt}
    ], 20000)

    // 解析JSON（更健壮）
    let t=raw.trim()
    // 去除 markdown 代码块
    t=t.replace(/```json\n?/gi,'').replace(/```/g,'')
    t=t.trim()
    let result
    try{
      result = JSON.parse(t)
    } catch(e){
      // 提取最外层 JSON
      const start=t.indexOf('{'), end=t.lastIndexOf('}')+1
      if(start>=0&&end>start){
        try{
          result = JSON.parse(t.slice(start,end))
        } catch(e2){
          const pos = parseInt(e2.message.match(/position (\d+)/)?.[1]||'0')
          return {error:'JSON解析失败，位置'+pos+'附近: '+t.slice(Math.max(0,pos-30),pos+30)}
        }
      } else {
        return {error:'JSON解析失败: '+t.slice(0,300)}
      }
    }

    return {
      subject:result.subject||'',
      grade:result.grade||'',
      score:parseInt(result.score)||0,
      summary:result.summary||'',
      highlights:result.highlights||[],
      issues:result.issues||[],
      typos:result.typos||[]
    }
  } catch(err) {
    return {error:err.message||'批改失败'}
  }
}
