// -------------------------------------------------------------
// โค้ดฉบับ Generic Proxy (ใช้ได้กับทุกระบบในอนาคต)
// -------------------------------------------------------------

const CHANNEL_ACCESS_TOKEN = 'ojNYw6S1JTB/CUbMt2gWi3OgHZussn0rMAN6EOF+8B0sNc2s5o34B38dEtxdYB+YO8WXVPNBFZU84tqLKf3wi2ldQ76wjicsXrF56Yo3CPM7FsFv31WRFzV4g8+KEp4Lufvu/1nYpbYopeOIgVtnlwdBO4t89/1O/w1cDnyiIFU=';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    // 1. รับคำสั่งแจ้งเตือนจากระบบอื่นๆ (เช่น React, ระบบ HR, ระบบบัญชี)
    // โดยระบบต้นทางต้องส่งข้อมูลมาในรูปแบบ { "type": "react", "to": "IDกลุ่มที่จะให้ส่ง", "message": "ข้อความ" }
    if (data.type === 'react' || data.type === 'notify') {
      if (data.to && data.message) {
        pushMessage(data.to, data.message);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'success' })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // 2. โค้ดสำหรับให้บอทคอยบอก "รหัสกลุ่ม (Group ID)" เวลาเราดึงมันเข้ากลุ่มใหม่ๆ
    if (data.events && data.events.length > 0) {
      const event = data.events[0];
      
      // ดึงเข้ากลุ่มปุ๊บ บอกรหัสปั๊บ
      if (event.type === 'join') {
        const source = event.source;
        let idToReply = source.groupId || source.roomId || source.userId;
        replyMessage(event.replyToken, 'ขอบคุณที่เชิญเข้ากลุ่มครับ!\nเพื่อตั้งค่าให้ระบบส่งแจ้งเตือนมาที่กลุ่มนี้ กรุณานำรหัสด้านล่างไปใส่ในระบบ:\n' + idToReply);
        return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(ContentService.MimeType.JSON);
      }
      
      // พิมพ์ "ขอไอดี" เพื่อถามรหัส
      if (event.type === 'message' && event.message.type === 'text') {
        const text = event.message.text.trim(); 
        if (text.includes('ขอไอดี')) {
          const source = event.source;
          let idToReply = source.groupId || source.roomId || source.userId;
          replyMessage(event.replyToken, 'Group ID ของกลุ่มนี้คือ:\n' + idToReply);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: 'ok' })).setMimeType(ContentService.MimeType.JSON);
    }
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ status: 'error' })).setMimeType(ContentService.MimeType.JSON);
  }
}

function pushMessage(to, text) {
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
    method: 'post',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN },
    payload: JSON.stringify({ to: to, messages: [{ type: 'text', text: text }] })
  });
}

function replyMessage(replyToken, text) {
  UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'post',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + CHANNEL_ACCESS_TOKEN },
    payload: JSON.stringify({ replyToken: replyToken, messages: [{ type: 'text', text: text }] })
  });
}
