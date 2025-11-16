/**
 * 抖音视频下载插件 - 稳定版
 * 使用多个备用解析源确保稳定性
 */

export default async function (ctx) {
  const { req, settings } = ctx;
  const videoUrl = req.url;
  const timeout = settings?.timeout || 30000;

  try {
    console.log('开始解析抖音视频:', videoUrl);
    
    // 获取最终的重定向URL（处理短链接）
    const finalUrl = await resolveRedirect(videoUrl, timeout);
    console.log('最终URL:', finalUrl);
    
    // 尝试多个解析源
    const videoInfo = await parseWithFallback(finalUrl, timeout);
    
    if (!videoInfo.downloadUrl) {
      throw new Error('无法获取视频下载地址');
    }

    // 验证URL协议
    if (!videoInfo.downloadUrl.startsWith('http')) {
      throw new Error(`不支持的协议: ${videoInfo.downloadUrl}`);
    }

    const result = {
      name: videoInfo.title || `抖音视频_${Date.now()}`,
      files: [
        {
          name: sanitizeFilename(videoInfo.filename),
          size: videoInfo.size || 0,
          req: {
            url: videoInfo.downloadUrl,
            headers: {
              'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
              'Referer': 'https://www.douyin.com/',
              'Accept': 'video/mp4,video/webm,video/*;q=0.9,*/*;q=0.8',
              'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
              'Range': 'bytes=0-',
            },
          },
        },
      ],
      extra: {
        cover: videoInfo.cover,
        author: videoInfo.author,
        duration: videoInfo.duration,
        platform: 'douyin'
      },
    };

    console.log('解析成功:', result.name);
    return result;

  } catch (error) {
    console.error('解析失败:', error);
    throw new Error(`抖音解析失败: ${error.message}`);
  }
}

/**
 * 解析短链接获取最终URL
 */
async function resolveRedirect(url, timeout) {
  if (!url.includes('v.douyin.com')) {
    return url;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1'
      }
    });
    
    clearTimeout(timeoutId);
    return response.url;
  } catch (error) {
    console.warn('短链接解析失败，使用原URL:', error);
    return url;
  }
}

/**
 * 使用多个备用解析源
 */
async function parseWithFallback(url, timeout) {
  const parsers = [
    parseWithAPI1,  // 主要解析源
    parseWithAPI2,  // 备用解析源1
    parseWithAPI3   // 备用解析源2
  ];

  for (const parser of parsers) {
    try {
      const result = await parser(url, timeout);
      if (result && result.downloadUrl) {
        console.log(`使用解析源成功: ${parser.name}`);
        return result;
      }
    } catch (error) {
      console.warn(`解析源 ${parser.name} 失败:`, error.message);
      continue;
    }
  }
  
  throw new Error('所有解析源都失败了');
}

/**
 * 解析源1: 使用稳定的第三方API
 */
async function parseWithAPI1(url, timeout) {
  const apiUrl = `https://api.jiexi.top/?url=${encodeURIComponent(url)}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`API1 HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    // 适配不同API返回格式
    if (data.url || data.videoUrl) {
      return {
        title: data.title || data.desc || '抖音视频',
        downloadUrl: data.url || data.videoUrl,
        cover: data.cover || data.coverUrl,
        author: data.author || data.nickname || '',
        duration: data.duration || 0,
        filename: `douyin_${Date.now()}.mp4`
      };
    }
    
    throw new Error('API1返回数据格式异常');
    
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * 解析源2: 备用API
 */
async function parseWithAPI2(url, timeout) {
  const apiUrl = `https://api.douyin.wtf/api?url=${encodeURIComponent(url)}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`API2 HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.nwm_video_url) {
      return {
        title: data.desc || '抖音视频',
        downloadUrl: data.nwm_video_url,
        cover: data.cover_url,
        author: data.author?.nickname || '',
        duration: data.duration || 0,
        filename: `douyin_${Date.now()}.mp4`
      };
    }
    
    throw new Error('API2返回数据格式异常');
    
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * 解析源3: 另一个备用API
 */
async function parseWithAPI3(url, timeout) {
  const apiUrl = `https://tenapi.cn/douyin/?url=${encodeURIComponent(url)}`;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`API3 HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.code === 200 && data.url) {
      return {
        title: data.title || '抖音视频',
        downloadUrl: data.url,
        cover: data.cover || '',
        author: data.author || '',
        duration: 0,
        filename: `douyin_${Date.now()}.mp4`
      };
    }
    
    throw new Error('API3返回数据格式异常');
    
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * 清理文件名
 */
function sanitizeFilename(filename) {
  // 移除或替换非法字符
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 200); // 限制文件名长度
}
