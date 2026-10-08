// ============================================================
// ไฟล์: client/src/utils/userService.js
//
// หน้าที่: ติดต่อ backend เกี่ยวกับบัญชีของผู้ใช้ที่ล็อกอินอยู่
//   1) getMyProfile     = ดึงข้อมูลส่วนตัว
//   2) updateMyProfile  = บันทึกชื่อ นามสกุล และอีเมล
//   3) changeMyPassword = เปลี่ยนรหัสผ่าน
//
// ทั้งสามฟังก์ชันถูกเรียกจากหน้า Profile.jsx
//
// แนวคิด:
//   Profile.jsx รับข้อมูลที่ผู้ใช้กรอก
//   → เรียกฟังก์ชันในไฟล์นี้
//   → ไฟล์นี้ส่งคำขอไป backend
//   → คืนผลกลับให้ Profile.jsx แสดงบนหน้าจอ
//
// ผลลัพธ์ที่คืนมีรูปแบบเดียวกัน:
//   isError = มีข้อผิดพลาดหรือไม่
//   data = ข้อมูลที่ backend ส่งกลับ
//   errorMessage = ข้อความแจ้งข้อผิดพลาด
// ============================================================

// นำเข้าการตั้งค่า เพื่อใช้ apiBaseUri เป็นที่อยู่ของ backend
// ถ้าจะเปลี่ยนที่อยู่ backend ให้ดูไฟล์ appConfig
import AppConfig from '../config/appConfig'

// นำเข้าฟังก์ชันสร้าง headers สำหรับยืนยันตัวตน
// ใช้แนบ token ไปกับคำขอ เพื่อให้ backend ตรวจสอบผู้เรียก
import { authHeaders } from './authHeaders'

// ============================================================
// 1) ดึงข้อมูลส่วนตัว
// ============================================================

// ดึงโปรไฟล์ของผู้ใช้ที่ login อยู่ (backend อ่าน user_id จาก JWT เอง ไม่ต้องส่งมา)

// export = เปิดให้ไฟล์อื่น import ฟังก์ชันนี้ไปใช้
// async = ทำให้ข้างในฟังก์ชันใช้ await เพื่อรอผลได้
// () ว่าง = ฟังก์ชันนี้ไม่รับข้อมูลผ่านพารามิเตอร์
export async function getMyProfile() {

  // fetch = ส่งคำขอไป backend
  // await = รอผลตอบกลับก่อนทำคำสั่งถัดไป
  // response = เก็บผลตอบกลับ HTTP เช่น สถานะและข้อมูล
  //
  // `${AppConfig.apiBaseUri}` = แทรกที่อยู่ backend ลงในข้อความ
  // /user/me = เส้นทางข้อมูลของผู้ใช้ที่ยืนยันตัวตนอยู่
  // เช่น http://localhost:8000/api/user/me
  const response = await fetch(`${AppConfig.apiBaseUri}/user/me`, {

    // GET = ขออ่านข้อมูลจาก backend
    method: 'GET',

    // เรียก authHeaders() เพื่อรับข้อมูลยืนยันตัวตน
    // ... = กระจาย properties ของออบเจ็กต์ที่ได้มาใส่ใน headers
    headers: { ...authHeaders() },

  }) // จบคำขอ แล้วเก็บผลตอบกลับไว้ใน response

  // response.json() = อ่านข้อมูลตอบกลับแล้วแปลงเป็นค่า JavaScript
  // await = รอให้อ่านและแปลงเสร็จ
  // .catch(() => null) = ถ้าอ่านหรือแปลง JSON ไม่สำเร็จ ให้ใช้ null
  //
  // catch นี้จัดการเฉพาะการอ่าน JSON
  // ถ้า fetch เชื่อมต่อ backend ไม่ได้ จะเกิด error ก่อนถึงบรรทัดนี้
  const json = await response.json().catch(() => null)

  // response.ok เป็น true เมื่อสถานะ HTTP อยู่ในช่วง 200–299
  // ! = กลับค่าจริงเป็นเท็จ และเท็จเป็นจริง
  // !response.ok จึงหมายถึง "สถานะตอบกลับไม่อยู่ในช่วงสำเร็จ"
  if (!response.ok) {

    // คืนผลแจ้งข้อผิดพลาด แล้วจบฟังก์ชันทันที
    // isError: true = มีข้อผิดพลาด
    // data: null = ไม่มีข้อมูลโปรไฟล์ให้ส่งกลับ
    //
    // json?.detail = อ่านข้อความ detail ที่ backend ส่งมา
    // ?. = ถ้า json เป็น null หรือ undefined จะไม่ error
    // || = ถ้าด้านซ้ายเป็นค่าที่ถือว่าไม่มี ให้ใช้ข้อความด้านขวา
    //
    // ถ้าอาจารย์ให้แก้ข้อความเมื่อโหลดข้อมูลไม่สำเร็จ ให้ดูตรงนี้
    return { isError: true, data: null, errorMessage: json?.detail || 'ไม่สามารถโหลดข้อมูลผู้ใช้ได้' }

  } // จบกรณีสถานะไม่สำเร็จ

  // ถ้าสถานะสำเร็จ จะมาถึงบรรทัดนี้
  // isError: false = ไม่มีข้อผิดพลาดตามการตรวจสถานะ HTTP
  // data: json = ส่งข้อมูลที่อ่านได้กลับไปให้ Profile.jsx
  // errorMessage: '' = ข้อความว่าง เพราะไม่มีข้อความผิดพลาด
  return { isError: false, data: json, errorMessage: '' }

} // จบฟังก์ชัน getMyProfile

// ============================================================
// 2) บันทึกข้อมูลส่วนตัว
// ============================================================

// อัปเดตชื่อ-นามสกุล-อีเมล

// { firstname, lastname, email } = รับออบเจ็กต์ แล้วดึงแต่ละช่องออกมา
// วิธีนี้เรียกว่า destructuring
//
// เช่น เรียกด้วย:
// updateMyProfile({
//   firstname: 'วีรชัย',
//   lastname: 'ราชเพ็ชร',
//   email: 'example@email.com'
// })
//
// firstname = ชื่อจริงที่ต้องการบันทึก
// lastname = นามสกุลที่ต้องการบันทึก
// email = อีเมลที่ต้องการบันทึก
export async function updateMyProfile({ firstname, lastname, email }) {

  // ส่งคำขอไป /user/me ซึ่งเป็น URL เดียวกับการอ่านโปรไฟล์
  // แต่ใช้ method ต่างกัน เพื่อระบุว่าครั้งนี้ต้องการแก้ไขข้อมูล
  const response = await fetch(`${AppConfig.apiBaseUri}/user/me`, {

    // PUT = ส่งข้อมูลเพื่ออัปเดตข้อมูลที่ backend
    method: 'PUT',

    // เริ่ม headers ซึ่งเก็บข้อมูลประกอบคำขอ
    headers: {

      // บอก backend ว่า body เป็นข้อความ JSON ที่ใช้ UTF-8
      // UTF-8 รองรับข้อความภาษาไทย
      'Content-Type': 'application/json; charset=UTF-8',

      // แนบข้อมูลยืนยันตัวตน เพื่อให้ backend ตรวจสอบว่าใครแก้ข้อมูล
      ...authHeaders(),

    }, // จบ headers

    // body = ข้อมูลหลักที่ส่งให้ backend
    // JSON.stringify = แปลงออบเจ็กต์ JavaScript เป็นข้อความ JSON
    body: JSON.stringify({

      // ส่งชื่อจริงผ่านช่อง firstname
      // ถ้า firstname เป็นข้อความว่าง '' จะส่ง null แทน
      // || ตรวจค่าที่เป็น falsy ด้วย เช่น undefined และ null
      firstname: firstname || null,

      // ส่งนามสกุลผ่านช่อง lastname
      // ถ้านามสกุลว่าง จะส่ง null แทนเช่นเดียวกับชื่อจริง
      lastname: lastname || null,

      // เขียนสั้นแทน email: email
      // ส่งอีเมลที่รับเข้ามา โดยไม่มีการเปลี่ยนค่าในบรรทัดนี้
      email,

    }), // จบออบเจ็กต์ข้อมูลและการแปลงเป็น JSON

  }) // จบ fetch และเก็บผลตอบกลับใน response

  // อ่านคำตอบเป็นค่า JavaScript
  // ถ้าอ่านหรือแปลง JSON ไม่สำเร็จ ให้ json เป็น null
  const json = await response.json().catch(() => null)

  // ถ้าสถานะ HTTP ไม่อยู่ในช่วง 200–299 ให้ถือว่าคำขอไม่สำเร็จ
  if (!response.ok) {

    // ส่งผลแจ้งข้อผิดพลาดกลับให้หน้า Profile.jsx
    // ใช้ detail จาก backend ก่อน ถ้าไม่มีค่าจึงใช้ข้อความสำรอง
    //
    // ถ้าอาจารย์ให้แก้ข้อความเมื่อบันทึกไม่สำเร็จ ให้ดูตรงนี้
    return { isError: true, data: null, errorMessage: json?.detail || 'บันทึกข้อมูลไม่สำเร็จ' }

  } // จบกรณีสถานะไม่สำเร็จ

  // ส่งข้อมูลตอบกลับให้หน้า Profile.jsx
  // หน้านั้นจะนำผลไปแจ้งผู้ใช้และอัปเดตชื่อที่เก็บใน AuthContext
  return { isError: false, data: json, errorMessage: '' }

} // จบฟังก์ชัน updateMyProfile

// ============================================================
// 3) เปลี่ยนรหัสผ่าน
// ============================================================

// เปลี่ยนรหัสผ่าน (ต้องส่งรหัสผ่านเดิมไปให้ backend ตรวจก่อนเสมอ)

// รับออบเจ็กต์ แล้วดึงค่ารหัสผ่านสองช่องออกมา
// currentPassword = รหัสผ่านปัจจุบันที่ผู้ใช้กรอก
// newPassword = รหัสผ่านใหม่ที่ผู้ใช้ต้องการใช้
//
// ฟังก์ชันนี้ไม่มีช่องยืนยันรหัสผ่าน
// หน้า Profile.jsx ตรวจว่ารหัสผ่านใหม่กับช่องยืนยันตรงกันก่อนเรียก
export async function changeMyPassword({ currentPassword, newPassword }) {

  // ส่งคำขอไปเส้นทางสำหรับเปลี่ยนรหัสผ่าน
  // เช่น http://localhost:8000/api/user/me/password
  const response = await fetch(`${AppConfig.apiBaseUri}/user/me/password`, {

    // PUT = ขออัปเดตรหัสผ่าน
    method: 'PUT',

    // เริ่มข้อมูลประกอบคำขอ
    headers: {

      // บอก backend ว่าข้อมูลที่ส่งเป็น JSON แบบ UTF-8
      'Content-Type': 'application/json; charset=UTF-8',

      // แนบข้อมูลยืนยันตัวตนไปด้วย
      ...authHeaders(),

    }, // จบ headers

    // แปลงข้อมูลรหัสผ่านเป็นข้อความ JSON ก่อนส่ง
    // โค้ดส่วนนี้ส่งค่าที่รับเข้ามาโดยตรง ไม่ได้ทำ SHA-256 ในไฟล์นี้
    body: JSON.stringify({

      // ส่งรหัสผ่านปัจจุบันให้ backend ตรวจสอบ
      // current_password = ชื่อช่องที่ backend รับ
      // currentPassword = ตัวแปร JavaScript ที่เก็บค่าผู้ใช้กรอก
      current_password: currentPassword,

      // ส่งรหัสผ่านใหม่ที่ต้องการใช้
      // new_password = ชื่อช่องที่ backend รับ
      // newPassword = ตัวแปร JavaScript ที่รับเข้ามา
      new_password: newPassword,

    }), // จบข้อมูลใน body และการแปลงเป็น JSON

  }) // จบคำขอเปลี่ยนรหัสผ่าน

  // อ่านคำตอบจาก backend
  // ถ้าอ่านหรือแปลง JSON ไม่สำเร็จ ให้ใช้ null
  const json = await response.json().catch(() => null)

  // ตรวจว่าสถานะ HTTP อยู่นอกช่วงสำเร็จหรือไม่
  if (!response.ok) {

    // คืนผลแจ้งข้อผิดพลาดให้ Profile.jsx แล้วจบฟังก์ชัน
    // ถ้า backend ส่ง detail ที่มีค่า จะใช้ข้อความนั้น
    // ถ้าไม่มี จะใช้ 'เปลี่ยนรหัสผ่านไม่สำเร็จ'
    return { isError: true, data: null, errorMessage: json?.detail || 'เปลี่ยนรหัสผ่านไม่สำเร็จ' }

  } // จบกรณีสถานะไม่สำเร็จ

  // คืนผลสำเร็จให้หน้า Profile.jsx
  // หน้านั้นจะเป็นคนแสดงข้อความสำเร็จและล้างช่องกรอกรหัสผ่าน
  return { isError: false, data: json, errorMessage: '' }

} // จบฟังก์ชัน changeMyPassword