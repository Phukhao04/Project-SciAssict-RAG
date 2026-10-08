// ============================================================
// ไฟล์: client/src/utils/ragService.js
//
// หน้าที่: ติดต่อ backend เกี่ยวกับแชท 3 อย่าง
//   1) chatRequest        = ส่งคำถามและรับคำตอบจากแชทบอท
//   2) getSessions        = ดึงรายการห้องแชทของผู้ใช้
//   3) getSessionMessages = ดึงข้อความในห้องแชทที่เลือก

// คำที่ใช้ในไฟล์นี้:
//   session = ห้องแชทหนึ่งห้อง หรือบทสนทนาหนึ่งชุด
//   sessionId = รหัสที่ใช้ระบุว่าเป็นห้องแชทไหน
//   headers = ข้อมูลประกอบคำขอ เช่น รูปแบบข้อมูลและ token
//   body = ข้อมูลหลักที่ส่งให้ backend เช่น คำถาม
//
// ไฟล์นี้รับส่งข้อมูล ไม่ได้วาดหน้าจอเอง
// ส่วนหน้าจอที่เรียกฟังก์ชัน จะนำผลลัพธ์ไปแสดงอีกที
// ============================================================

// นำเข้าการตั้งค่า เพื่อใช้ AppConfig.apiBaseUri เป็นที่อยู่ backend
import AppConfig from "../config/appConfig";

// นำเข้าฟังก์ชันสร้าง headers สำหรับยืนยันตัวตน
// เวลาเรียก authHeaders() จะได้ข้อมูลที่ใช้แนบไปกับคำขอ
import { authHeaders } from "./authHeaders";

// ============================================================
// 1) ส่งคำถามให้แชทบอท
//
// export = เปิดให้ไฟล์อื่น import ฟังก์ชันนี้ไปใช้
// async = ทำให้ภายในฟังก์ชันใช้ await เพื่อรอผลได้
//
// ค่าที่รับเข้ามา:
//   question = ข้อความคำถามที่ผู้ใช้พิมพ์
//   userId = รหัสของผู้ใช้ที่ถาม
//   sessionId = รหัสห้องแชทที่กำลังคุย
//   k = จำนวนผลค้นคืนที่ขอให้ backend ใช้ประกอบการตอบ
//
// sessionId = null:
//   ถ้าไม่ได้ส่งค่านี้ หรือส่ง undefined จะใช้ null
//   เป็นการส่งไปโดยยังไม่ได้ระบุรหัสห้องแชท
//
// k = 5:
//   ถ้าไม่ได้ส่งค่านี้ หรือส่ง undefined จะใช้ 5
//   ถ้าอาจารย์ให้เปลี่ยนจำนวนผลค้นคืนเริ่มต้น ให้ดูตรงนี้
//   แต่ถ้าผู้เรียกส่ง k มาเอง ค่าที่ส่งมาจะถูกใช้แทน
// ============================================================
export async function chatRequest(question, userId, sessionId = null, k = 5) {

  // fetch(...) = ส่งคำขอไป backend
  // await = รอให้ได้รับการตอบกลับ ก่อนทำคำสั่งถัดไป
  // response = เก็บผลตอบกลับ HTTP เช่น สถานะและข้อมูลคำตอบ
  //
  // `${...}` = นำค่าตัวแปรมาแทรกในข้อความ
  // เช่น apiBaseUri เป็น http://localhost:8000/api
  // URL ที่ใช้จะเป็น http://localhost:8000/api/rag/chat
  //
  // ถ้า backend เปลี่ยนเส้นทางรับคำถาม ให้ดู /rag/chat
  const response = await fetch(`${AppConfig.apiBaseUri}/rag/chat`, {

    // POST = ส่งข้อมูลให้ backend ประมวลผล
    method: "POST",

    // เริ่มออบเจ็กต์ headers ซึ่งเก็บข้อมูลประกอบคำขอ
    headers: {

      // บอก backend ว่าข้อมูลใน body เป็น JSON และใช้ UTF-8
      "Content-Type": "application/json; charset=UTF-8",

      // เรียก authHeaders() แล้วนำ properties ที่ได้มาใส่ใน headers นี้
      // ... คือ spread syntax: กระจายข้อมูลจากออบเจ็กต์เข้ามา
      // จึงส่งข้อมูลยืนยันตัวตนไปพร้อมกับ Content-Type
      ...authHeaders(),

    }, // จบ headers

    // JSON.stringify(...) = แปลงออบเจ็กต์ JavaScript เป็นข้อความ JSON
    //
    // question เขียนสั้นแทน question: question
    // k เขียนสั้นแทน k: k
    // user_id: userId = ส่งค่า userId โดยใช้ชื่อช่องว่า user_id
    // session_id: sessionId = ส่งค่า sessionId โดยใช้ชื่อช่องว่า session_id
    //
    // ชื่อช่องที่ส่งต้องตรงกับที่ backend รับ
    // ถ้าอาจารย์ให้เพิ่มข้อมูลที่ส่ง ให้ดู body ตรงนี้และฝั่ง backend ด้วย
    body: JSON.stringify({ question, k, user_id: userId, session_id: sessionId }),

  }); // จบการเรียก fetch และเก็บผลตอบกลับไว้ใน response

  // response.json() = อ่านข้อมูลตอบกลับแล้วแปลงเป็นค่า JavaScript
  // await = รอให้อ่านและแปลงข้อมูลเสร็จ
  // .catch(() => null) = ถ้าอ่านหรือแปลง JSON ไม่สำเร็จ ให้ใช้ null
  //
  // catch ตรงนี้ครอบคลุมการอ่าน JSON
  // ถ้า fetch ด้านบนเชื่อมต่อ backend ไม่ได้ จะเกิด error ก่อนถึงบรรทัดนี้
  const json = await response.json().catch(() => null);

  // === = เปรียบเทียบว่าค่าและชนิดข้อมูลตรงกันหรือไม่
  // status 200 = backend ตอบกลับด้วยสถานะสำเร็จ
  if (response.status === 200) {

    // return = ส่งผลลัพธ์กลับให้ส่วนที่เรียก chatRequest แล้วจบฟังก์ชัน
    //
    // isError: false = แจ้งว่าไม่มีข้อผิดพลาด
    // answer: json.answer = คำตอบที่ backend ส่งมา
    // sources: json.sources || [] = แหล่งข้อมูลที่ใช้ประกอบคำตอบ
    //   ถ้า json.sources เป็นค่าที่ถือว่าไม่มี เช่น null หรือ undefined
    //   จะใช้ array ว่าง [] แทน
    // sessionId: json.session_id = รหัสห้องแชทที่ backend ส่งกลับมา
    //
    // บรรทัดนี้คาดว่า json เป็นออบเจ็กต์คำตอบที่มีรูปแบบถูกต้อง
    // ถ้า json เป็น null จะอ่าน json.answer ไม่ได้
    return { isError: false, answer: json.answer, sources: json.sources || [], sessionId: json.session_id };

  } // จบกรณีสถานะ 200

  // ถ้าสถานะไม่ใช่ 200 จะทำส่วนนี้
  // ส่งผลลัพธ์แจ้งข้อผิดพลาดกลับไปให้ส่วนที่เรียกใช้
  return {

    // isError: true = มีข้อผิดพลาด
    // answer: "" = ไม่มีข้อความคำตอบ
    // sources: [] = ไม่มีรายการแหล่งข้อมูล
    // sessionId: null = ไม่มีรหัสห้องแชทในผลลัพธ์นี้
    isError: true, answer: "", sources: [], sessionId: null,

    // json?.detail = อ่าน detail จากคำตอบ backend
    // ?. = ถ้า json เป็น null หรือ undefined จะได้ undefined โดยไม่ error
    //
    // || = ถ้าค่าด้านซ้ายเป็นค่าที่ถือว่าไม่มี ให้ใช้ด้านขวา
    // จึงใช้ข้อความสำรองเมื่อ backend ไม่ได้ส่ง detail ที่มีค่า
    //
    // ถ้าอาจารย์ให้แก้ข้อความแจ้งข้อผิดพลาด ให้ดูข้อความตรงนี้
    errorMessage: json?.detail || "ระบบตอบคำถามขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง",

  }; // จบออบเจ็กต์ผลลัพธ์ข้อผิดพลาด

} // จบฟังก์ชัน chatRequest

// ============================================================
// 2) ดึงรายการห้องแชท
//
// ไม่รับพารามิเตอร์
// ส่งข้อมูลยืนยันตัวตนไปให้ backend ใช้ตรวจสอบผู้เรียก
//
// ข้อมูลที่ได้สามารถนำไปแสดงเป็นรายการแชทในหน้าจอ
// ============================================================
export async function getSessions() {

  // ส่งคำขอไปที่ /chat/sessions แล้วรอการตอบกลับ
  // ไม่ได้กำหนด method จึงใช้ GET ซึ่งเป็นค่าเริ่มต้นของ fetch
  // GET = ขออ่านข้อมูลจาก backend
  const response = await fetch(`${AppConfig.apiBaseUri}/chat/sessions`, {

    // สร้าง headers โดยนำข้อมูลจาก authHeaders() มาใส่
    // ใช้แนบข้อมูลยืนยันตัวตนไปกับคำขอ
    headers: { ...authHeaders() },

  }); // จบคำขอดึงรายการห้องแชท

  // !== = ไม่เท่ากัน โดยพิจารณาชนิดข้อมูลด้วย
  // ถ้าสถานะไม่ใช่ 200 ให้คืน array ว่าง [] และจบฟังก์ชัน
  // ส่วนที่เรียกจึงไม่ได้รับรายการแชทในกรณีนี้
  if (response.status !== 200) return [];

  // ถ้าสถานะเป็น 200 อ่าน JSON แล้วส่งข้อมูลนั้นกลับไป
  // รูปร่างของข้อมูลที่ได้ขึ้นอยู่กับคำตอบจาก backend
  return await response.json();

} // จบฟังก์ชัน getSessions

// ============================================================
// 3) ดึงข้อความในห้องแชทที่เลือก
//
// sessionId = รหัสของห้องแชทที่ต้องการอ่าน
// เช่น เมื่อคลิกห้องแชทหนึ่งห้อง จะส่งรหัสห้องนั้นเข้ามา
// ============================================================
export async function getSessionMessages(sessionId) {

  // แทรก sessionId ลงใน URL เพื่อระบุห้องแชท
  // เช่น sessionId เป็น abc
  // เส้นทางจะเป็น /chat/sessions/abc/messages
  //
  // ใช้ GET เพราะไม่ได้กำหนด method
  // await = รอ backend ตอบก่อนทำคำสั่งถัดไป
  const response = await fetch(`${AppConfig.apiBaseUri}/chat/sessions/${sessionId}/messages`, {

    // แนบข้อมูลยืนยันตัวตนไปกับคำขออ่านข้อความ
    headers: { ...authHeaders() },

  }); // จบคำขอดึงข้อความของห้องแชท

  // ถ้าสถานะไม่ใช่ 200 ให้ส่ง array ว่างกลับไปและจบฟังก์ชัน
  if (response.status !== 200) return [];

  // ถ้าสถานะเป็น 200 อ่านข้อมูล JSON แล้วส่งกลับให้ส่วนที่เรียก
  // ส่วนหน้าจอจะนำข้อมูลนี้ไปแสดงเป็นข้อความในห้องแชท
  return await response.json();

} // จบฟังก์ชัน getSessionMessages