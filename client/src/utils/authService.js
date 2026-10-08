// ============================================================
// ไฟล์: client/src/utils/authService.js
// หน้าที่: ฟังก์ชันคุยกับ backend เรื่องบัญชีผู้ใช้ 3 อย่าง
//   1) authenRequest  = ล็อกอินขั้นที่ 1 (ถามหา "บัตรชั่วคราว")
//   2) accessRequest  = ล็อกอินขั้นที่ 2 (พิสูจน์ว่ารู้รหัสผ่าน แลกเป็น "บัตรผ่านจริง" JWT)
//   3) registerRequest = สมัครสมาชิก
//   ทั้งสามฟังก์ชันถูกเรียกจาก pages/Login.jsx
//
// แนวคิดล็อกอินแบบ 2 ขั้น (Challenge-Response):
//   ไม่ส่งรหัสผ่านจริงทางเน็ต แต่ส่ง "ลายเซ็น" ที่คำนวณจากรหัสผ่านด้วย SHA-256
//   (SHA-256 = แปลงข้อความเป็นรหัสยาวคงที่ ย้อนกลับไม่ได้)
//   server คำนวณสูตรเดียวกันจากข้อมูลของตัวเอง ถ้าตรงกัน = รู้รหัสผ่านจริง
//   ถ้าอาจารย์ให้แก้สูตร ต้องแก้ให้ตรงกับ server (auth_crud.py) ทั้งสองฝั่งพร้อมกัน
// ============================================================

import CryptoJS from "crypto-js"; // ไลบรารีเข้ารหัส ใช้ฟังก์ชัน SHA256
import AppConfig from "../config/appConfig"; // ที่อยู่ของ backend
import { getFormattedDate } from "./dateUtil"; // ฟังก์ชันแปลงวันที่เป็น วัน-เดือน-ปี

// --- ขั้นตอน authen_request ---
// async = ฟังก์ชันนี้ทำงานแบบ "รอผลได้" (ข้างในใช้ await ได้)
export async function authenRequest(username) {
  const now = new Date(); // เวลาปัจจุบันของเครื่องผู้ใช้
  const formattedDateString = getFormattedDate(now); // แปลงเป็นข้อความ เช่น "05-10-2026"

  // ต่อข้อความ "ชื่อผู้ใช้&วันที่" เช่น "ryu&05-10-2026" (ใส่วันที่เพื่อให้รหัสเปลี่ยนทุกวัน)
  const combinedString = `${username}&${formattedDateString}`;
  console.log(combinedString); // พิมพ์ลง Console ของเบราว์เซอร์ (ไว้ดีบัก)

  // SHA256(...) = เข้ารหัสข้อความ  .toString() = แปลงผลเป็นข้อความตัวอักษร (hex ยาว 64 ตัว)
  const authenRequestString = CryptoJS.SHA256(combinedString).toString();
  console.log(authenRequestString); // พิมพ์ผล hash ไว้ดีบัก

  // fetch = ส่งคำขอไปหา server  await = รอจนกว่า server จะตอบ แล้วค่อยทำบรรทัดถัดไป
  // URL = http://localhost:8000/api/authen/authen_request
  const response = await fetch(`${AppConfig.apiBaseUri}/authen/authen_request`, {
    method: "POST", // POST = ส่งข้อมูลไปให้ server ประมวลผล
    headers: {
      // บอก server ว่าข้อมูลที่ส่งเป็นรูปแบบ JSON ตัวอักษร UTF-8 (รองรับภาษาไทย)
      "Content-Type": "application/json; charset=UTF-8",
    },
    // body = ข้อมูลที่ส่ง  JSON.stringify = แปลงออบเจ็กต์ JS เป็นข้อความ JSON
    // ชื่อ authen_request ต้องตรงกับที่ backend รอรับ (AuthenRequestBody)
    body: JSON.stringify({ authen_request: authenRequestString }),
  });

  const json = await response.json(); // อ่านคำตอบของ server แล้วแปลงจากข้อความ JSON เป็นออบเจ็กต์ (ต้อง await เพราะใช้เวลา)
  console.log(json); // พิมพ์คำตอบไว้ดีบัก

  // คืนผลให้ Login.jsx ในรูปแบบมาตรฐานของโปรเจกต์: { isError, data, errorMessage }
  return {
    isError: json.isError, // true = มีข้อผิดพลาด (เช่น ไม่พบผู้ใช้)
    data: json.data, // ถ้าสำเร็จ = "บัตรชั่วคราว" (authen_token) ที่ server ออกให้
    errorMessage: json.errorMessage, // ข้อความผิดพลาด (ว่างถ้าสำเร็จ)
  };
}

// --- ขั้นตอน access_request ---
// รับ username, password จริงที่ผู้ใช้พิมพ์ และ authenToken (บัตรชั่วคราวจากขั้นที่ 1)
export async function accessRequest(username, password, authenToken) {
  // เข้ารหัสรหัสผ่านก่อน (ฐานข้อมูลเก็บรหัสผ่านในรูป SHA-256 เช่นกัน จึงเทียบกันได้)
  const passwordEncode = CryptoJS.SHA256(password).toString();

  // ต่อข้อความ "ชื่อ&รหัสผ่านที่เข้ารหัสแล้ว&บัตรชั่วคราว" แล้วเข้ารหัสอีกรอบ = "ลายเซ็น"
  const combinedString = `${username}&${passwordEncode}&${authenToken}`;
  const authenSignature = CryptoJS.SHA256(combinedString).toString();

  console.log(combinedString); // ดีบัก: ข้อความก่อนทำลายเซ็น (มี hash ของรหัสผ่านอยู่ ควรระวังตอนใช้งานจริง)
  console.log(authenSignature); // ดีบัก: ลายเซ็นที่ได้

  // ส่งคำขอไป http://localhost:8000/api/authen/access_request
  const response = await fetch(`${AppConfig.apiBaseUri}/authen/access_request`, {
    method: "POST", // ส่งข้อมูลไปให้ server
    headers: {
      "Content-Type": "application/json; charset=UTF-8", // ข้อมูลเป็น JSON UTF-8
    },
    body: JSON.stringify({
      authen_signature: authenSignature, // ลายเซ็นที่เพิ่งคำนวณ (server จะคำนวณเทียบ)
      authen_token: authenToken, // ส่งบัตรชั่วคราวกลับไปด้วย เพื่อให้ server ตรวจว่าเป็นของจริงและไม่หมดอายุ
    }),
  });

  const json = await response.json(); // อ่านคำตอบเป็นออบเจ็กต์
  console.log(json); // พิมพ์คำตอบไว้ดีบัก

  // !json.isError = "ไม่มีข้อผิดพลาด" = ล็อกอินสำเร็จ
  if (!json.isError) {
    // เก็บ "บัตรผ่านจริง (JWT)" ลง localStorage ไว้ให้ authHeaders.js ดึงไปแนบทุกคำขอต่อไป
    localStorage.setItem("access_token", json.data.access_token);
    localStorage.setItem("username", username); // เก็บชื่อผู้ใช้ไว้ด้วย
  }

  // คืนผลรูปแบบเดียวกับขั้นที่ 1
  return {
    isError: json.isError, // true = รหัสผ่านไม่ถูกต้อง ฯลฯ
    data: json.data, // ถ้าสำเร็จ = ข้อมูลผู้ใช้ (access_token, user_id, username, firstname, lastname, role_id)
    errorMessage: json.errorMessage, // ข้อความผิดพลาด
  };
}


// *********** //
//register

// --- ขั้นตอน register ---

// ({ ... }) ในพารามิเตอร์ = รับค่าเป็นออบเจ็กต์ แล้วดึงแต่ละช่องออกมาเป็นตัวแปรทันที (destructuring)
// เรียกใช้เช่น registerRequest({ username: "a", password: "b", ... })
export async function registerRequest({
  username, // ชื่อผู้ใช้
  password, // รหัสผ่านจริง
  email, // อีเมล
  roleId, // รหัสบทบาท (Login.jsx ส่ง 'R02' = ผู้ใช้ทั่วไป)
  firstname, // ชื่อจริง (ไม่บังคับ)
  lastname, // นามสกุล (ไม่บังคับ)
}) {

  // ส่งคำขอสมัครไป http://localhost:8000/api/authen/register
  const response = await fetch(
    `${AppConfig.apiBaseUri}/authen/register`,
    {
      method: "POST", // ส่งข้อมูลไปให้ server
      headers: {
        "Content-Type": "application/json; charset=UTF-8", // ข้อมูลเป็น JSON UTF-8
      },
      body: JSON.stringify({
        username, // เขียนสั้น = username: username (ชื่อคีย์เท่ากับชื่อตัวแปร)
        password, // ส่ง plaintext ครั้งเดียวตอนสมัคร (ควรใช้ HTTPS ตอน Deploy)
        email, // อีเมล
        role_id: roleId, // เปลี่ยนชื่อเป็น role_id ให้ตรงกับที่ backend รอรับ (รูปแบบ snake_case ของ Python)
        firstname: firstname || null, // ถ้า firstname เป็นข้อความว่าง "" ให้ส่ง null แทน (|| = ถ้าซ้ายว่างให้ใช้ขวา)
        lastname: lastname || null, // เช่นเดียวกับบรรทัดบน
      }),
    }
  );

  // อ่านคำตอบ .catch(() => null) = ถ้าแปลงเป็น JSON ไม่ได้ (server ตอบแปลกๆ) ให้ได้ null แทนที่จะ error
  const json = await response.json().catch(() => null);

  // สมัครสำเร็จ
  // response.status = รหัสสถานะ HTTP (200 = สำเร็จ)
  if (response.status === 200) {
    return {
      isError: false, // ไม่มีข้อผิดพลาด
      data: json, // ข้อมูลที่ server ตอบกลับ (user_id, username, email)
      errorMessage: "", // ไม่มีข้อความผิดพลาด
    };
  }

  // ข้อมูลไม่ถูกต้อง
  // 400 = คำขอมีปัญหา เช่น ชื่อผู้ใช้ถูกใช้ไปแล้ว
  if (response.status === 400) {
    return {
      isError: true, // มีข้อผิดพลาด
      data: null, // ไม่มีข้อมูล
      // json?.detail = ข้อความผิดพลาดจาก server (?. = ถ้า json เป็น null ไม่ error แต่ได้ undefined)
      // || "สมัครสมาชิกไม่สำเร็จ" = ถ้าไม่มี ใช้ข้อความสำรอง
      errorMessage: json?.detail || "สมัครสมาชิกไม่สำเร็จ",
    };
  }

  // Validation Error
  // 422 = รูปแบบข้อมูลไม่ผ่านการตรวจของ server (เช่น อีเมลผิดรูปแบบ, รหัสผ่านสั้นเกินไป)
  if (response.status === 422) {
    const fieldErrors = {}; // ออบเจ็กต์ว่างไว้เก็บ "ช่องไหน ผิดเพราะอะไร" เช่น { email: "..." }

    // Array.isArray(...) = เช็คว่า json.detail เป็นรายการ (array) จริงไหม ก่อนวนอ่าน
    if (Array.isArray(json?.detail)) {
      // for...of = วนอ่านทีละข้อผิดพลาดในรายการ
      for (const item of json.detail) {
        // item.loc = ตำแหน่งที่ผิด เช่น ["body", "email"] → เอาตัวสุดท้าย ("email") เป็นชื่อช่อง
        // item.loc.length - 1 = ตำแหน่งสุดท้ายของรายการ
        const field = item.loc?.[item.loc.length - 1];

        if (field) {
          fieldErrors[field] = item.msg; // เก็บข้อความผิดพลาดของช่องนั้น (item.msg = ข้อความจาก server)
        }
      }
    }

    return {
      isError: true, // มีข้อผิดพลาด
      data: null, // ไม่มีข้อมูล
      errorMessage: "", // ไม่ใช้ข้อความรวม เพราะจะแสดงแยกใต้แต่ละช่องแทน
      fieldErrors, // ส่งรายการ error รายช่องกลับไปให้ Login.jsx แสดง
    };
  }

  // กรณีอื่น ๆ
  // สถานะอื่นที่ไม่ได้คาดไว้ (เช่น 500 server พัง) → ข้อความทั่วไป
  return {
    isError: true, // มีข้อผิดพลาด
    data: null, // ไม่มีข้อมูล
    errorMessage: "ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง", // แจ้งผู้ใช้แบบทั่วไป
  };
}