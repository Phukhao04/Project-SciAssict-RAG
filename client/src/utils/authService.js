import CryptoJS from "crypto-js";
import AppConfig from "../config/appConfig";
import { getFormattedDate } from "./dateUtil";

// --- ขั้นตอน authen_request ---
export async function authenRequest(username) {
  const now = new Date();
  const formattedDateString = getFormattedDate(now);

  const combinedString = `${username}&${formattedDateString}`;
  console.log(combinedString);

  const authenRequestString = CryptoJS.SHA256(combinedString).toString();
  console.log(authenRequestString);

  const response = await fetch(`${AppConfig.apiBaseUri}/authen/authen_request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({ authen_request: authenRequestString }),
  });

  const json = await response.json();
  console.log(json);

  return {
    isError: json.isError,
    data: json.data,
    errorMessage: json.errorMessage,
  };
}

// --- ขั้นตอน access_request ---
export async function accessRequest(username, password, authenToken) {
  const passwordEncode = CryptoJS.SHA256(password).toString();

  const combinedString = `${username}&${passwordEncode}&${authenToken}`;
  const authenSignature = CryptoJS.SHA256(combinedString).toString();

  console.log(combinedString);
  console.log(authenSignature);

  const response = await fetch(`${AppConfig.apiBaseUri}/authen/access_request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      authen_signature: authenSignature,
      authen_token: authenToken,
    }),
  });

  const json = await response.json();
  console.log(json);

  if (!json.isError) {
    localStorage.setItem("access_token", json.data.access_token);
    localStorage.setItem("username", username);
  }

  return {
    isError: json.isError,
    data: json.data,
    errorMessage: json.errorMessage,
  };
}

// *********** //
//register
export async function registerRequest({
  username,
  password,
  email,
  roleId,
  firstname,
  lastname,
}) {
  const response = await fetch(
    `${AppConfig.apiBaseUri}/authen/register`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        username,
        password, // ส่ง plaintext ครั้งเดียวตอนสมัคร (ควรใช้ HTTPS ตอน Deploy)
        email,
        role_id: roleId,
        firstname: firstname || null,
        lastname: lastname || null,
      }),
    }
  );

  const json = await response.json().catch(() => null);

  // สมัครสำเร็จ
  if (response.status === 200) {
    return {
      isError: false,
      data: json,
      errorMessage: "",
    };
  }

  // ข้อมูลไม่ถูกต้อง
  if (response.status === 400) {
    return {
      isError: true,
      data: null,
      errorMessage: json?.detail || "สมัครสมาชิกไม่สำเร็จ",
    };
  }

  // Validation Error
  if (response.status === 422) {
    const fieldErrors = {};

    if (Array.isArray(json?.detail)) {
      for (const item of json.detail) {
        const field = item.loc?.[item.loc.length - 1];

        if (field) {
          fieldErrors[field] = item.msg;
        }
      }
    }

    return {
      isError: true,
      data: null,
      errorMessage: "",
      fieldErrors,
    };
  }

  // กรณีอื่น ๆ
  return {
    isError: true,
    data: null,
    errorMessage: "ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง",
  };
}

